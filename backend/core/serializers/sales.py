from decimal import Decimal

from rest_framework import serializers

from ..models import Sale, SaleItem


class SaleItemSerializer(serializers.ModelSerializer):
    line_total = serializers.SerializerMethodField()
    product_reference = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = SaleItem
        fields = [
            "id", "product", "product_reference", "product_name", "product_sku",
            "quantity", "unit_price", "unit_cost", "line_total",
        ]
        read_only_fields = fields

    def get_line_total(self, obj) -> str:
        return str(obj.line_total)


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(
        source="customer.display_name", read_only=True, default=None
    )
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_method_display = serializers.CharField(
        source="get_payment_method_display", read_only=True
    )
    gross_profit = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id", "number", "customer", "customer_name", "seller", "seller_name",
            "payment_method", "payment_method_display", "discount", "total_amount",
            "cost_amount", "gross_profit", "status", "status_display",
            "cancellation_reason", "cancelled_at", "created_at", "updated_at",
            "items",
        ]
        read_only_fields = fields

    def get_gross_profit(self, obj) -> str:
        return str(obj.gross_profit)


class SaleCreateLineSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class SaleCreateSerializer(serializers.Serializer):
    items = SaleCreateLineSerializer(many=True)
    payment_method = serializers.ChoiceField(
        choices=Sale.PaymentMethod.choices, default=Sale.PaymentMethod.CASH
    )
    customer = serializers.IntegerField(required=False, allow_null=True, default=None)
    discount = serializers.DecimalField(
        max_digits=12, decimal_places=0, min_value=Decimal("0"), default=Decimal("0")
    )
    idempotency_key = serializers.CharField(
        max_length=64, required=False, allow_blank=True, default=""
    )


class SaleCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
