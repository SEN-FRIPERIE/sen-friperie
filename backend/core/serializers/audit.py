from rest_framework import serializers

from ..models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_display = serializers.CharField(source="user.display_name", read_only=True, default=None)
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id", "user", "user_display", "action", "action_display",
            "object_type", "object_id", "summary", "created_at",
        ]
        read_only_fields = fields
