from django.db import connection
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Endpoint de santé pour les checks Render / monitoring."""
    database = "unknown"
    try:
        connection.ensure_connection()
        database = connection.vendor
    except Exception:  # noqa: BLE001 - on renvoie l'état sans lever d'erreur
        database = "unavailable"

    return Response(
        {
            "status": "ok",
            "service": "sen-friperie-api",
            "database": database,
            "time": timezone.now().isoformat(),
        }
    )
