"""Gestion uniforme des erreurs de l'API."""

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """Handler DRF : réponses d'erreur homogènes {"detail": ...} ou {"champs": ...}."""
    if isinstance(exc, DjangoPermissionDenied):
        exc = APIException(detail=str(exc) or "Accès refusé.")
        exc.status_code = status.HTTP_403_FORBIDDEN
    elif isinstance(exc, Http404):
        exc = APIException(detail="Ressource introuvable.")
        exc.status_code = status.HTTP_404_NOT_FOUND

    response = drf_exception_handler(exc, context)

    if response is None:
        logger.error("Erreur API non gérée : %s", exc, exc_info=exc)
        return Response(
            {"detail": "Une erreur interne est survenue."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # DRF renvoie {"detail": ...} ou {"champ": ["erreur", ...]} ; on normalise.
    if isinstance(response.data, dict) and "detail" not in response.data:
        response.data = {"detail": "Données invalides.", "fields": response.data}
    return response
