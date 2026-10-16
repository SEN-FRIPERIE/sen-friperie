"""Logique métier des approvisionnements (entrées de stock atomiques)."""

from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from ..models import Product, Purchase, PurchaseItem, StockMovement


def create_purchase(*, user, supplier_id, items, date, notes=""):
    """Enregistre une réception et incrémente le stock de façon atomique."""
    if not items:
        raise ValidationError({"items": "Ajoutez au moins un article."})

    supplier = None
    if supplier_id:
        from ..models import Supplier

        supplier = Supplier.objects.filter(pk=supplier_id).first()
        if not supplier:
            raise ValidationError({"supplier": "Fournisseur introuvable."})

    parsed = []
    for line in items:
        try:
            pid = int(line.get("product_id"))
            qty = int(line.get("quantity"))
            cost = Decimal(str(line.get("unit_cost", "0")))
        except (TypeError, ValueError) as exc:
            raise ValidationError({"items": "Ligne d'approvisionnement invalide."}) from exc
        if qty <= 0:
            raise ValidationError({"items": "Les quantités doivent être supérieures à 0."})
        if cost < 0:
            raise ValidationError({"items": "Le coût unitaire ne peut pas être négatif."})
        parsed.append((pid, qty, cost))

    with transaction.atomic():
        purchase = Purchase.objects.create(
            supplier=supplier, date=date, notes=notes, created_by=user
        )

        total = Decimal("0")
        product_ids = {pid for pid, _, _ in parsed}
        products = {
            p.pk: p
            for p in Product.objects.select_for_update().filter(pk__in=product_ids)
        }

        for pid, qty, cost in parsed:
            product = products.get(pid)
            if product is None:
                raise ValidationError({"items": f"Produit {pid} introuvable."})

            PurchaseItem.objects.create(
                purchase=purchase, product=product, quantity=qty, unit_cost=cost
            )
            total += qty * cost

            product.quantity += qty
            # Le dernier coût d'achat connu sert de référence pour le calcul
            # du bénéfice sur les prochaines ventes.
            if cost > 0:
                product.purchase_price = cost
            product.save(update_fields=["quantity", "purchase_price", "updated_at"])

            StockMovement.objects.create(
                product=product,
                movement_type=StockMovement.Type.PURCHASE,
                quantity=qty,
                unit_cost=cost,
                reason=f"Approvisionnement {purchase.reference or purchase.pk}",
                user=user,
                purchase=purchase,
            )

        purchase.total_cost = total
        purchase.save(update_fields=["total_cost"])

    return purchase
