"""Journalisation des événements importants (aucune donnée sensible)."""

from .models import AuditLog


def log_audit(request, action, object_type, summary, object_id=None):
    """Écrit une entrée au journal d'activité. Ne jamais y passer de secrets."""
    user = getattr(request, "user", None)
    if user is not None and not user.is_authenticated:
        user = None
    AuditLog.objects.create(
        user=user,
        action=action,
        object_type=object_type,
        object_id=str(object_id) if object_id not in (None, "") else "",
        summary=str(summary)[:255],
    )
