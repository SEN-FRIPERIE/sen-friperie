from .access import access_rights_view
from .audit import AuditLogViewSet
from .auth import csrf_view, health, login_view, logout_view, me_view, register_view
from .catalog import CategoryViewSet, ProductViewSet, StockMovementViewSet
from .dashboard import dashboard_view
from .people import CustomerViewSet, SupplierViewSet
from .purchasing import PurchaseViewSet
from .reports import reports_sales_csv, reports_view
from .sales import SaleViewSet
from .shop import shop_settings_view
from .users import UserViewSet

__all__ = [
    "AuditLogViewSet",
    "login_view", "logout_view", "me_view", "csrf_view", "register_view",
    "CategoryViewSet", "ProductViewSet", "StockMovementViewSet",
    "dashboard_view",
    "CustomerViewSet", "SupplierViewSet",
    "PurchaseViewSet",
    "reports_sales_csv", "reports_view",
    "SaleViewSet",
    "shop_settings_view",
    "UserViewSet",
]
