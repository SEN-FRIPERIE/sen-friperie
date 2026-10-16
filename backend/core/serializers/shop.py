from rest_framework import serializers

from ..models import Sale, ShopSettings


class ShopSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        fields = [
            "id", "shop_name", "phone", "email", "address", "currency",
            "default_low_stock_threshold", "receipt_header", "receipt_footer",
            "payment_methods",
        ]

    def validate_payment_methods(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Les modes de paiement doivent être une liste.")
        allowed = {choice for choice, _ in Sale.PaymentMethod.choices}
        unknown = [v for v in value if v not in allowed]
        if unknown:
            raise serializers.ValidationError(
                f"Modes de paiement inconnus : {', '.join(map(str, unknown))}."
            )
        return value
