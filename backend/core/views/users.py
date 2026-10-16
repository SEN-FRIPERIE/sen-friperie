from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ..audit import log_audit
from ..models import AuditLog, User
from ..permissions import IsAdmin
from ..serializers.users import UserSerializer, UserWriteSerializer


class UserViewSet(viewsets.ModelViewSet):
    """Gestion des utilisateurs — réservée aux administrateurs."""

    permission_classes = [IsAdmin]
    queryset = User.objects.all().order_by("username")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return UserWriteSerializer
        return UserSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        user = serializer.save()
        log_audit(
            self.request, AuditLog.Action.USER_MANAGEMENT, "User",
            f"Création de l'utilisateur {user.username}", user.pk,
        )

    def perform_update(self, serializer):
        user = serializer.save()
        log_audit(
            self.request, AuditLog.Action.USER_MANAGEMENT, "User",
            f"Modification de l'utilisateur {user.username}", user.pk,
        )

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise ValidationError({"detail": "Vous ne pouvez pas supprimer votre propre compte."})
        username = instance.username
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_audit(
            self.request, AuditLog.Action.USER_MANAGEMENT, "User",
            f"Désactivation de l'utilisateur {username}", instance.pk,
        )

    @action(detail=False, methods=["post"], url_path="invite")
    def invite(self, request):
        """Crée un compte vendeur avec un mot de passe initial fourni par l'admin."""
        serializer = UserWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save(role=User.Role.VENDOR, is_active=True)
        log_audit(
            request, AuditLog.Action.USER_MANAGEMENT, "User",
            f"Invitation de l'utilisateur {user.username}", user.pk,
        )
        return Response(UserSerializer(user).data, status=201)
