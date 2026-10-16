from rest_framework import viewsets

from ..models import AuditLog
from ..permissions import IsAdmin
from ..serializers import AuditLogSerializer  # noqa: F401 — voir serializers/audit.py


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Journal d'activité — lecture seule, réservée aux administrateurs."""

    permission_classes = [IsAdmin]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.select_related("user").all()

    def get_queryset(self):
        qs = self.queryset
        params = self.request.query_params
        action_param = params.get("action")
        if action_param:
            qs = qs.filter(action=action_param)
        object_type = params.get("object_type")
        if object_type:
            qs = qs.filter(object_type=object_type)
        user = params.get("user")
        if user:
            qs = qs.filter(user_id=user)
        return qs.order_by("-created_at")
