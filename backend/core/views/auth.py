from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ..audit import log_audit
from ..models import AuditLog, User
from ..serializers.users import LoginSerializer, RegisterSerializer, UserSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_view(request):
    """Renvoie et pose le cookie CSRF utilisé par le frontend (SPA)."""
    return Response({"detail": "Cookie CSRF initialisé."})


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    """Inscription publique : crée un compte Vendeur et ouvre la session.

    Le rôle est toujours forcé à VENDOR (jamais ADMIN). Les mots de passe sont
    hachés par Django via ``set_password``. Réutilise l'auth par session.
    """
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    login(request, user)
    log_audit(
        request, AuditLog.Action.USER_MANAGEMENT, "User",
        f"Inscription de {user.username}", user.pk,
    )
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    identifier = serializer.validated_data["username"].strip()
    password = serializer.validated_data["password"]

    # Accepte l'identifiant ou l'e-mail, sans tenir compte de la casse
    # (les inscriptions publiques utilisent l'e-mail comme identifiant).
    match = (
        User.objects.filter(username__iexact=identifier).first()
        or User.objects.filter(email__iexact=identifier).first()
    )
    username = match.username if match else identifier

    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_active:
        return Response(
            {"detail": "Identifiants invalides ou compte désactivé."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    login(request, user)
    log_audit(request, AuditLog.Action.LOGIN, "User", f"Connexion de {user.username}")
    return Response(UserSerializer(user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    user = request.user
    logout(request)
    log_audit(request, AuditLog.Action.LOGOUT, "User", f"Déconnexion de {user.username}")
    return Response({"detail": "Déconnexion réussie."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Endpoint de santé pour les checks Render / monitoring."""
    from django.db import connection

    from django.utils import timezone as tz

    database = "unknown"
    try:
        connection.ensure_connection()
        database = connection.vendor
    except Exception:  # noqa: BLE001
        database = "unavailable"

    return Response(
        {
            "status": "ok",
            "service": "sen-friperie-api",
            "database": database,
            "time": tz.now().isoformat(),
        }
    )
