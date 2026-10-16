"""Logique métier des ventes : recalcul serveur, stock, transaction atomique."""

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import Customer, Product, Sale, SaleItem, StockMovement


class DuplicateSaleError(Exception):
    """Double validation détectée via la clé d'idempotence."""

    def __init__(self, sale):
        self.sale = sale
        super().__init__("Vente déjà enregistrée.")


def create_sale(*, user, items, payment_method, customer_id=None,
                discount=Decimal("0"), idempotency_key=None):
    """Crée une vente de façon atomique.

    - Recalcule tous les montants côté serveur (jamais de total client).
    - Vérifie et décrémente le stock avec verrouillage des lignes produits.
    - Conserve prix et coût en instantanés sur chaque ligne.
    - Idempotence : si ``idempotency_key`` existe déjà, renvoie la vente existante.
    """
    if not items:
        raise ValidationError({"items": "Le panier est vide."})

    if idempotency_key:
        existing = Sale.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            raise DuplicateSaleError(existing)

    try:
        discount = Decimal(str(discount or "0"))
    except Exception as exc:  # noqa: BLE001
        raise ValidationError({"discount": "Remise invalide."}) from exc
    if discount < 0:
        raise ValidationError({"discount": "La remise ne peut pas être négative."})

    customer = None
    if customer_id:
        customer = Customer.objects.filter(pk=customer_id).first()
        if not customer:
            raise ValidationError({"customer": "Client introuvable."})

    product_ids = []
    for line in items:
        try:
            pid = int(line.get("product_id"))
            qty = int(line.get("quantity"))
        except (TypeError, ValueError) as exc:
            raise ValidationError({"items": "Ligne de panier invalide."}) from exc
        if qty <= 0:
            raise ValidationError({"items": "La quantité doit être supérieure à 0."})
        product_ids.append((pid, qty))

    try:
        return _create_sale_tx(
            user=user,
            items=product_ids,
            payment_method=payment_method,
            customer=customer,
            discount=discount,
            idempotency_key=idempotency_key,
        )
    except IntegrityError as exc:
        # Course possible : deux validations simultanées avec la même clé.
        if idempotency_key:
            existing = Sale.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                raise DuplicateSaleError(existing) from exc
        raise


def _create_sale_tx(*, user, items, payment_method, customer, discount, idempotency_key):
    with transaction.atomic():
        products = {
            p.pk: p
            for p in Product.objects.select_for_update().filter(
                pk__in={pid for pid, _ in items}, is_archived=False
            )
        }

        sale = Sale.objects.create(
            customer=customer,
            seller=user,
            payment_method=payment_method,
            discount=discount,
            status=Sale.Status.COMPLETED,
            idempotency_key=idempotency_key,
        )

        subtotal = Decimal("0")
        cost_total = Decimal("0")

        for pid, qty in items:
            product = products.get(pid)
            if product is None:
                raise ValidationError({"items": f"Produit {pid} introuvable ou archivé."})
            if product.quantity < qty:
                raise ValidationError(
                    {
                        "items": (
                            f"Stock insuffisant pour « {product.name} » : "
                            f"{product.quantity} disponible(s), {qty} demandé(s)."
                        )
                    }
                )

            subtotal += product.sale_price * qty
            cost_total += product.purchase_price * qty

            SaleItem.objects.create(
                sale=sale,
                product=product,
                product_name=product.name,
                product_sku=product.sku,
                quantity=qty,
                unit_price=product.sale_price,
                unit_cost=product.purchase_price,
            )

            product.quantity -= qty
            product.save(update_fields=["quantity", "updated_at"])

            StockMovement.objects.create(
                product=product,
                movement_type=StockMovement.Type.SALE,
                quantity=qty,
                unit_cost=product.purchase_price,
                reason=f"Vente {sale.pk}",
                user=user,
                sale=sale,
            )

        total = subtotal - discount
        if total < 0:
            raise ValidationError({"discount": "La remise dépasse le sous-total."})

        sale.total_amount = total
        sale.cost_amount = cost_total
        sale.save(update_fields=["total_amount", "cost_amount"])

    return sale


def cancel_sale(*, sale, user, reason=""):
    """Annule une vente : restaure le stock et conserve la trace d'audit."""
    with transaction.atomic():
        locked = Sale.objects.select_for_update().get(pk=sale.pk)
        if locked.status == Sale.Status.CANCELLED:
            raise ValidationError({"detail": "Cette vente est déjà annulée."})

        for item in locked.items.select_related("product"):
            product = Product.objects.select_for_update().get(pk=item.product_id)
            product.quantity += item.quantity
            product.save(update_fields=["quantity", "updated_at"])
            StockMovement.objects.create(
                product=product,
                movement_type=StockMovement.Type.CANCELLATION,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                reason=f"Annulation vente {locked.number}".strip(),
                user=user,
                sale=locked,
            )

        locked.status = Sale.Status.CANCELLED
        locked.cancellation_reason = reason[:255]
        locked.cancelled_at = timezone.now()
        locked.cancelled_by = user
        locked.save(
            update_fields=[
                "status", "cancellation_reason", "cancelled_at", "cancelled_by", "updated_at",
            ]
        )
    return locked
