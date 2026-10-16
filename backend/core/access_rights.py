"""Matrice des droits d'accès par rôle (lecture seule).

Source unique de vérité pour la page « Droits d'accès » : les niveaux sont
déduits des ``permission_classes`` réellement appliquées par chaque vue, afin
que la documentation ne puisse jamais dériver du code.

Aucune donnée n'est modifiée : ce module ne fait que décrire les permissions.
"""

from .models import User

# Niveaux d'accès exposés au frontend.
FULL = "full"
READ = "read"
NONE = "none"

LEVEL_LABELS = {
    FULL: "Accès complet",
    READ: "Lecture seule",
    NONE: "Aucun accès",
}

LEVEL_DESCRIPTIONS = {
    FULL: "Peut consulter et modifier (créer, modifier, supprimer ou annuler).",
    READ: "Peut consulter, mais pas modifier.",
    NONE: "Ne voit ni n'utilise cette section.",
}


def _permission_classes(view):
    """Récupère les permissions DRF d'un ViewSet (classe) ou d'une vue fonction."""
    target = getattr(view, "cls", view)
    return list(getattr(target, "permission_classes", []) or [])


def _levels_for(permission_classes):
    """Traduit des permissions DRF en (niveau administrateur, niveau vendeur)."""
    names = {cls.__name__ for cls in permission_classes}
    if "IsAdmin" in names:
        return FULL, NONE
    if "IsAdminOrReadOnly" in names:
        return FULL, READ
    if "IsSellerOrAdmin" in names:
        return FULL, FULL
    # Permission inconnue : on ne présume d'aucun droit.
    return NONE, NONE


def _module(view, key, label, description):
    admin, vendor = _levels_for(_permission_classes(view))
    return {
        "key": key,
        "label": label,
        "description": description,
        "access": {User.Role.ADMIN: admin, User.Role.VENDOR: vendor},
    }


def get_access_matrix():
    """Construit la matrice des droits par section, à partir des vues réelles."""
    from .views.audit import AuditLogViewSet
    from .views.catalog import CategoryViewSet, ProductViewSet, StockMovementViewSet
    from .views.dashboard import dashboard_view
    from .views.people import CustomerViewSet, SupplierViewSet
    from .views.purchasing import PurchaseViewSet
    from .views.reports import reports_view
    from .views.sales import SaleViewSet
    from .views.shop import shop_settings_view
    from .views.users import UserViewSet

    sections = [
        {
            "name": "Boutique",
            "modules": [
                _module(
                    dashboard_view, "dashboard", "Tableau de bord",
                    "Indicateurs de ventes, de stock et de performances.",
                ),
                _module(
                    SaleViewSet, "sales", "Caisse et ventes",
                    "Enregistrer, consulter et annuler des ventes ; imprimer les reçus.",
                ),
                _module(
                    PurchaseViewSet, "purchases", "Approvisionnements",
                    "Réception de marchandises et entrées de stock.",
                ),
                _module(
                    StockMovementViewSet, "stock_movements", "Mouvements de stock",
                    "Historique des entrées, sorties et ajustements.",
                ),
            ],
        },
        {
            "name": "Catalogue",
            "modules": [
                _module(
                    ProductViewSet, "products", "Produits",
                    "Fiches produit, prix, stock, archivage et ajustements.",
                ),
                _module(
                    CategoryViewSet, "categories", "Catégories",
                    "Classement des produits et archivage.",
                ),
            ],
        },
        {
            "name": "Tiers",
            "modules": [
                _module(
                    CustomerViewSet, "customers", "Clients",
                    "Coordonnées et historique d'achat.",
                ),
                _module(
                    SupplierViewSet, "suppliers", "Fournisseurs",
                    "Coordonnées et achats associés.",
                ),
            ],
        },
        {
            "name": "Pilotage",
            "modules": [
                _module(
                    reports_view, "reports", "Rapports",
                    "Statistiques de ventes et export CSV.",
                ),
                _module(
                    UserViewSet, "users", "Utilisateurs",
                    "Comptes, rôles et activation des vendeurs.",
                ),
                _module(
                    AuditLogViewSet, "audit", "Journal d'activité",
                    "Traçabilité des actions de tous les comptes.",
                ),
                _module(
                    shop_settings_view, "settings", "Paramètres boutique",
                    "Informations de la boutique et valeur de la monnaie.",
                ),
            ],
        },
    ]

    return {
        "roles": [
            {"key": User.Role.ADMIN, "label": "Administrateur"},
            {"key": User.Role.VENDOR, "label": "Vendeur"},
        ],
        "levels": [
            {
                "key": level,
                "label": LEVEL_LABELS[level],
                "description": LEVEL_DESCRIPTIONS[level],
            }
            for level in (FULL, READ, NONE)
        ],
        "sections": sections,
    }
