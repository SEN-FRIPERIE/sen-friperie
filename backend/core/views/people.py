from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..audit import log_audit
from ..models import AuditLog, Customer, Sale, Supplier
from ..permissions import IsAdminOrReadOnly
from ..serializers.people import CustomerSerializer, SupplierSerializer
from ..serializers.sales import SaleSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = CustomerSerializer
    queryset = Customer.objects.all()

    def get_queryset(self):
        qs = self.queryset
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(last_name__icontains=search)
                | Q(first_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(email__icontains=search)
            )
        return qs.order_by("last_name", "first_name")

    def perform_create(self, serializer):
        customer = serializer.save()
        log_audit(self.request, AuditLog.Action.CREATE, "Customer",
                  f"Création du client {customer.display_name}", customer.pk)

    def perform_update(self, serializer):
        customer = serializer.save()
        log_audit(self.request, AuditLog.Action.UPDATE, "Customer",
                  f"Modification du client {customer.display_name}", customer.pk)

    @action(detail=True, methods=["get"])
    def sales(self, request, pk=None):
        """Historique des achats du client."""
        customer = self.get_object()
        qs = Sale.objects.filter(customer=customer).select_related("seller", "customer")
        page = self.paginate_queryset(qs)
        serializer = SaleSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)


class SupplierViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = SupplierSerializer
    queryset = Supplier.objects.all()

    def get_queryset(self):
        qs = self.queryset
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(phone__icontains=search))
        return qs.order_by("name")

    def perform_create(self, serializer):
        supplier = serializer.save()
        log_audit(self.request, AuditLog.Action.CREATE, "Supplier",
                  f"Création du fournisseur {supplier.name}", supplier.pk)

    def perform_update(self, serializer):
        supplier = serializer.save()
        log_audit(self.request, AuditLog.Action.UPDATE, "Supplier",
                  f"Modification du fournisseur {supplier.name}", supplier.pk)
