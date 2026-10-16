from django.db.models import F, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ..audit import log_audit
from ..models import AuditLog, Category, Product, StockMovement
from ..permissions import IsAdminOrReadOnly, IsSellerOrAdmin
from ..serializers.catalog import (
    CategorySerializer,
    ProductSerializer,
    StockMovementSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = CategorySerializer
    queryset = Category.objects.all()

    def get_queryset(self):
        qs = self.queryset
        if self.request.query_params.get("include_archived") != "true":
            qs = qs.filter(is_active=True)
        return qs.order_by("name")

    def perform_create(self, serializer):
        category = serializer.save()
        log_audit(self.request, AuditLog.Action.CREATE, "Category",
                  f"Création de la catégorie {category.name}", category.pk)

    def perform_update(self, serializer):
        category = serializer.save()
        log_audit(self.request, AuditLog.Action.UPDATE, "Category",
                  f"Modification de la catégorie {category.name}", category.pk)

    def perform_destroy(self, instance):
        if instance.products.exists():
            raise ValidationError(
                {"detail": "Des produits sont encore liés à cette catégorie. Archivez-la plutôt."}
            )
        name = instance.name
        instance.delete()
        log_audit(self.request, AuditLog.Action.DELETE, "Category",
                  f"Suppression de la catégorie {name}")

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        category = self.get_object()
        category.is_active = not category.is_active
        category.save(update_fields=["is_active", "updated_at"])
        log_audit(request, AuditLog.Action.ARCHIVE, "Category",
                  f"Catégorie {category.name} {'activée' if category.is_active else 'archivée'}",
                  category.pk)
        return Response(CategorySerializer(category).data)


class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = ProductSerializer
    queryset = Product.objects.select_related("category").all()

    def get_queryset(self):
        qs = self.queryset
        params = self.request.query_params

        if params.get("include_archived") != "true":
            qs = qs.filter(is_archived=False)

        search = params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(sku__icontains=search))

        category = params.get("category")
        if category:
            qs = qs.filter(category_id=category)

        size = params.get("size")
        if size:
            qs = qs.filter(size=size)

        condition = params.get("condition")
        if condition:
            qs = qs.filter(condition=condition)

        availability = params.get("availability")
        if availability == "in_stock":
            qs = qs.filter(quantity__gt=0)
        elif availability == "low":
            qs = qs.filter(quantity__gt=0, quantity__lte=F("low_stock_threshold"))
        elif availability == "out":
            qs = qs.filter(quantity=0)

        ordering = params.get("ordering", "-created_at")
        allowed = {
            "name", "-name", "sale_price", "-sale_price",
            "quantity", "-quantity", "created_at", "-created_at",
        }
        if ordering in allowed:
            qs = qs.order_by(ordering)
        return qs

    def perform_create(self, serializer):
        product = serializer.save()
        log_audit(self.request, AuditLog.Action.CREATE, "Product",
                  f"Création du produit {product.sku}", product.pk)

    def perform_update(self, serializer):
        product = serializer.save()
        log_audit(self.request, AuditLog.Action.UPDATE, "Product",
                  f"Modification du produit {product.sku}", product.pk)

    def perform_destroy(self, instance):
        # Les ventes référencent le produit (PROTECT) : archivage sécurisé.
        if instance.sale_items.exists() or instance.quantity > 0:
            raise ValidationError(
                {"detail": "Ce produit a un historique ou du stock. Archivez-le plutôt."}
            )
        sku = instance.sku
        instance.delete()
        log_audit(self.request, AuditLog.Action.DELETE, "Product",
                  f"Suppression du produit {sku}")

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        product = self.get_object()
        product.is_archived = not product.is_archived
        product.save(update_fields=["is_archived", "updated_at"])
        log_audit(request, AuditLog.Action.ARCHIVE, "Product",
                  f"Produit {product.sku} {'archivé' if product.is_archived else 'désarchivé'}",
                  product.pk)
        return Response(ProductSerializer(product).data)

    @action(detail=True, methods=["post"], url_path="adjust-stock")
    def adjust_stock(self, request, pk=None):
        """Ajustement manuel de stock (entrée/sortie traçable)."""
        product = self.get_object()
        try:
            delta = int(request.data.get("quantity", 0))
        except (TypeError, ValueError) as exc:
            raise ValidationError({"quantity": "Quantité invalide."}) from exc
        if delta == 0:
            raise ValidationError({"quantity": "La quantité ne peut pas être 0."})
        if delta < 0 and product.quantity + delta < 0:
            raise ValidationError(
                {"quantity": f"Stock insuffisant : {product.quantity} disponible(s)."}
            )
        reason = str(request.data.get("reason", "")).strip() or "Ajustement manuel"

        product.quantity += delta
        product.save(update_fields=["quantity", "updated_at"])
        StockMovement.objects.create(
            product=product,
            movement_type=StockMovement.Type.ADJUSTMENT,
            quantity=abs(delta),
            unit_cost=product.purchase_price,
            reason=reason,
            user=request.user,
        )
        log_audit(request, AuditLog.Action.STOCK_IN if delta > 0 else AuditLog.Action.STOCK_OUT,
                  "Product", f"Ajustement de stock {product.sku} : {delta:+d}", product.pk)
        return Response(ProductSerializer(product).data)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsSellerOrAdmin]
    serializer_class = StockMovementSerializer
    queryset = StockMovement.objects.select_related("product", "user").all()

    def get_queryset(self):
        qs = self.queryset
        product = self.request.query_params.get("product")
        if product:
            qs = qs.filter(product_id=product)
        movement_type = self.request.query_params.get("type")
        if movement_type:
            qs = qs.filter(movement_type=movement_type)
        return qs.order_by("-created_at")
