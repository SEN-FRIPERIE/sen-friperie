from rest_framework import serializers

from ..models import Category, Product, StockMovement


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "description", "is_active", "product_count", "created_at"]
        read_only_fields = ["created_at"]

    def validate_name(self, value):
        value = value.strip()
        qs = Category.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Une catégorie avec ce nom existe déjà.")
        return value


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    is_low_stock = serializers.BooleanField(read_only=True)
    is_out_of_stock = serializers.BooleanField(read_only=True)
    margin = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "sku", "name", "description", "category", "category_name",
            "size", "color", "condition", "purchase_price", "sale_price",
            "quantity", "low_stock_threshold", "image_url", "is_archived",
            "is_low_stock", "is_out_of_stock", "margin",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_margin(self, obj) -> str:
        return str(obj.sale_price - obj.purchase_price)

    def validate_sku(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("La référence est obligatoire.")
        qs = Product.objects.filter(sku=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Cette référence existe déjà.")
        return value

    def validate(self, attrs):
        sale_price = attrs.get("sale_price", getattr(self.instance, "sale_price", None))
        purchase_price = attrs.get(
            "purchase_price", getattr(self.instance, "purchase_price", None)
        )
        if sale_price is not None and purchase_price is not None and sale_price < purchase_price:
            raise serializers.ValidationError(
                {"sale_price": "Le prix de vente est inférieur au prix d'achat. Vérifiez avant de continuer."}
            )
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", None))
        if quantity is not None and quantity < 0:
            raise serializers.ValidationError({"quantity": "La quantité ne peut pas être négative."})
        return attrs


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    user_display = serializers.CharField(source="user.display_name", read_only=True, default=None)
    movement_type_display = serializers.CharField(
        source="get_movement_type_display", read_only=True
    )
    signed_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id", "product", "product_name", "product_sku", "movement_type",
            "movement_type_display", "quantity", "signed_quantity", "unit_cost",
            "reason", "user", "user_display", "sale", "purchase", "created_at",
        ]
        read_only_fields = fields
