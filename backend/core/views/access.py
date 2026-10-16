from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..access_rights import get_access_matrix
from ..permissions import IsAdmin


@api_view(["GET"])
@permission_classes([IsAdmin])
def access_rights_view(request):
    """Matrice des droits d'accès par rôle — lecture seule, réservée aux admins."""
    return Response(get_access_matrix())
