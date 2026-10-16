from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..audit import log_audit
from ..models import AuditLog, ShopSettings
from ..permissions import IsAdminOrReadOnly
from ..serializers.shop import ShopSettingsSerializer


@api_view(["GET", "PATCH"])
@permission_classes([IsAdminOrReadOnly])
def shop_settings_view(request):
    settings_obj = ShopSettings.get()
    if request.method == "PATCH":
        serializer = ShopSettingsSerializer(
            settings_obj, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit(request, AuditLog.Action.UPDATE, "ShopSettings",
                  "Modification des paramètres de la boutique", settings_obj.pk)
        return Response(serializer.data)
    return Response(ShopSettingsSerializer(settings_obj).data)
