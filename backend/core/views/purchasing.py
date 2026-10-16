from django.utils import timezone
from rest_framework import viewsets
from rest_framework.response import Response

from ..audit import log_audit
from ..models import AuditLog, Purchase
from ..permissions import IsSellerOrAdmin
from ..serializers.purchasing import PurchaseCreateSerializer, PurchaseSerializer
from ..services.purchasing import create_purchase


class PurchaseViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsSellerOrAdmin]
    serializer_class = PurchaseSerializer
    queryset = Purchase.objects.select_related(
        "supplier", "created_by"
    ).prefetch_related("items__product")

    def get_queryset(self):
        qs = self.queryset
        params = self.request.query_params
        date_from = params.get("date_from")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        date_to = params.get("date_to")
        if date_to:
            qs = qs.filter(date__lte=date_to)
        supplier = params.get("supplier")
        if supplier:
            qs = qs.filter(supplier_id=supplier)
        return qs.order_by("-date", "-created_at")

    def create(self, request, *args, **kwargs):
        serializer = PurchaseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        purchase = create_purchase(
            user=request.user,
            supplier_id=data.get("supplier"),
            items=data["items"],
            date=data.get("date") or timezone.localdate(),
            notes=data.get("notes", ""),
        )
        log_audit(request, AuditLog.Action.PURCHASE, "Purchase",
                  f"Approvisionnement {purchase.reference} — {purchase.total_cost}",
                  purchase.pk)
        return Response(PurchaseSerializer(purchase).data, status=201)
