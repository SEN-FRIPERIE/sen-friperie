from decimal import Decimal

from rest_framework import serializers

from ..models import Purchase, PurchaseItem


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseItem
        fields = [
            "id", "product", "product_name", "product_sku", "quantity",
            "unit_cost", "line_total",
        ]
        read_only_fields = fields

    def get_line_total(self, obj) -> str:
        return str(obj.line_total)


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default=None)
    created_by_name = serializers.CharField(
        source="created_by.display_name", read_only=True, default=None
    )

    class Meta:
        model = Purchase
        fields = [
            "id", "reference", "supplier", "supplier_name", "date", "notes",
            "total_cost", "created_by", "created_by_name", "created_at", "items",
        ]
        read_only_fields = fields


class PurchaseCreateLineSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    unit_cost = serializers.DecimalField(
        max_digits=12, decimal_places=0, min_value=Decimal("0")
    )


class PurchaseCreateSerializer(serializers.Serializer):
    supplier = serializers.IntegerField(required=False, allow_null=True, default=None)
    date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    items = PurchaseCreateLineSerializer(many=True)
