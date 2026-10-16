from decimal import Decimal

from django.db.models import Count, Sum
from rest_framework import serializers

from ..models import Customer, Supplier


class CustomerSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    total_purchases = serializers.SerializerMethodField()
    purchase_count = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id", "first_name", "last_name", "display_name", "phone", "email",
            "address", "notes", "total_purchases", "purchase_count", "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_total_purchases(self, obj) -> str:
        from ..models import Sale

        agg = Sale.objects.filter(
            customer=obj, status=Sale.Status.COMPLETED
        ).aggregate(total=Sum("total_amount"))
        return str(agg["total"] or Decimal("0"))

    def get_purchase_count(self, obj) -> int:
        from ..models import Sale

        return Sale.objects.filter(
            customer=obj, status=Sale.Status.COMPLETED
        ).aggregate(n=Count("id"))["n"]


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id", "name", "phone", "email", "address", "notes", "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_name(self, value):
        value = value.strip()
        qs = Supplier.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Un fournisseur avec ce nom existe déjà.")
        return value
