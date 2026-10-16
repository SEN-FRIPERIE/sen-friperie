from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ..audit import log_audit
from ..models import AuditLog, Sale
from ..permissions import IsSellerOrAdmin
from ..serializers.sales import (
    SaleCancelSerializer,
    SaleCreateSerializer,
    SaleSerializer,
)
from ..services.sales import DuplicateSaleError, cancel_sale, create_sale


class SaleViewSet(viewsets.ReadOnlyModelViewSet):
    """Lecture des ventes + création/annulation transactionnelles.

    Les ventes enregistrées ne sont jamais supprimées : uniquement annulées
    avec restauration du stock et trace d'audit.
    """

    permission_classes = [IsSellerOrAdmin]
    serializer_class = SaleSerializer
    queryset = Sale.objects.select_related("customer", "seller").prefetch_related("items")

    def get_queryset(self):
        qs = self.queryset
        params = self.request.query_params

        date_from = params.get("date_from")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        date_to = params.get("date_to")
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        seller = params.get("seller")
        if seller:
            qs = qs.filter(seller_id=seller)
        payment_method = params.get("payment_method")
        if payment_method:
            qs = qs.filter(payment_method=payment_method)
        status_param = params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        customer = params.get("customer")
        if customer:
            qs = qs.filter(customer_id=customer)
        search = params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(number__icontains=search)
                | Q(customer__last_name__icontains=search)
                | Q(customer__first_name__icontains=search)
            )
        return qs.order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            sale = create_sale(
                user=request.user,
                items=data["items"],
                payment_method=data["payment_method"],
                customer_id=data.get("customer"),
                discount=data.get("discount", 0),
                idempotency_key=data.get("idempotency_key") or None,
            )
        except DuplicateSaleError as exc:
            return Response(
                SaleSerializer(exc.sale).data, status=200,
                headers={"X-Idempotent-Replay": "true"},
            )
        log_audit(request, AuditLog.Action.SALE, "Sale",
                  f"Vente {sale.number} — {sale.total_amount}", sale.pk)
        return Response(SaleSerializer(sale).data, status=201)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        sale = self.get_object()
        serializer = SaleCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            sale = cancel_sale(
                sale=sale, user=request.user,
                reason=serializer.validated_data.get("reason", ""),
            )
        except ValidationError as exc:
            return Response(exc.detail, status=400)
        log_audit(request, AuditLog.Action.SALE_CANCEL, "Sale",
                  f"Annulation de la vente {sale.number}", sale.pk)
        return Response(SaleSerializer(sale).data)

    @action(detail=True, methods=["get"])
    def receipt(self, request, pk=None):
        """Données du reçu imprimable."""
        sale = self.get_object()
        from ..models import ShopSettings

        settings_obj = ShopSettings.get()
        payload = SaleSerializer(sale).data
        payload["shop"] = {
            "name": settings_obj.shop_name,
            "phone": settings_obj.phone,
            "address": settings_obj.address,
            "currency": settings_obj.currency,
            "receipt_header": settings_obj.receipt_header,
            "receipt_footer": settings_obj.receipt_footer,
        }
        return Response(payload)
