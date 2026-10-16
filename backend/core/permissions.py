from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdmin(BasePermission):
    """Autorise uniquement les utilisateurs au rôle administrateur."""

    message = "Réservé aux administrateurs."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_admin_role)


class IsSellerOrAdmin(BasePermission):
    """Autorise vendeurs et administrateurs (accès de base à l'application)."""

    message = "Compte vendeur ou administrateur requis."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated)


class IsAdminOrReadOnly(BasePermission):
    """Lecture pour les utilisateurs authentifiés, écriture réservée à l'admin."""

    message = "Seuls les administrateurs peuvent modifier."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.is_admin_role
