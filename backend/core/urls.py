from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AuditLogViewSet,
    CategoryViewSet,
    CustomerViewSet,
    ProductViewSet,
    PurchaseViewSet,
    SaleViewSet,
    StockMovementViewSet,
    SupplierViewSet,
    UserViewSet,
    access_rights_view,
    csrf_view,
    dashboard_view,
    health,
    login_view,
    logout_view,
    me_view,
    register_view,
    reports_sales_csv,
    reports_view,
    shop_settings_view,
)

app_name = "core"

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("categories", CategoryViewSet, basename="category")
router.register("products", ProductViewSet, basename="product")
router.register("stock-movements", StockMovementViewSet, basename="stockmovement")
router.register("customers", CustomerViewSet, basename="customer")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("purchases", PurchaseViewSet, basename="purchase")
router.register("sales", SaleViewSet, basename="sale")
router.register("audit-logs", AuditLogViewSet, basename="auditlog")

urlpatterns = [
    path("health/", health, name="health"),
    path("auth/csrf/", csrf_view, name="csrf"),
    path("auth/login/", login_view, name="login"),
    path("auth/register/", register_view, name="register"),
    path("auth/logout/", logout_view, name="logout"),
    path("auth/me/", me_view, name="me"),
    path("dashboard/", dashboard_view, name="dashboard"),
    path("reports/", reports_view, name="reports"),
    path("reports/sales/export/", reports_sales_csv, name="reports-sales-csv"),
    path("settings/shop/", shop_settings_view, name="shop-settings"),
    path("access-rights/", access_rights_view, name="access-rights"),
    path("", include(router.urls)),
]
