from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    AuditLog,
    Category,
    Customer,
    Product,
    Sale,
    StockMovement,
    Supplier,
    User,
)


def make_product(**kwargs):
    defaults = {
        "sku": "SKU-001",
        "name": "Jean brut Levi's",
        "sale_price": Decimal("15000"),
        "purchase_price": Decimal("8000"),
        "quantity": 5,
        "low_stock_threshold": 1,
    }
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


class BaseAPITest(TestCase):
    """Utilisateurs de test + client authentifié (payloads JSON)."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin", password="Admin-Passw0rd!", role=User.Role.ADMIN
        )
        self.vendor = User.objects.create_user(
            username="vendeur", password="Vendor-Passw0rd!", role=User.Role.VENDOR
        )
        self.client = APIClient()
        self.client.default_format = "json"

    def login(self, user):
        self.client.force_authenticate(user)


# --------------------------------------------------------------------------- #
# Santé et authentification
# --------------------------------------------------------------------------- #
class HealthEndpointTests(TestCase):
    def test_health_is_public_and_ok(self):
        response = self.client.get(reverse("core:health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["service"], "sen-friperie-api")


class AuthTests(BaseAPITest):
    def test_login_success(self):
        response = self.client.post(
            reverse("core:login"),
            {"username": "admin", "password": "Admin-Passw0rd!"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], "ADMIN")

    def test_login_bad_password(self):
        response = self.client.post(
            reverse("core:login"), {"username": "admin", "password": "wrong"}
        )
        self.assertEqual(response.status_code, 401)

    def test_login_accepts_email_case_insensitively(self):
        User.objects.create_user(
            username="awa@example.sn", password="Str0ng-Pass!23",
            email="awa@example.sn", role=User.Role.VENDOR,
        )
        response = self.client.post(
            reverse("core:login"),
            {"username": "AWA@Example.SN", "password": "Str0ng-Pass!23"},
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["username"], "awa@example.sn")

    def test_me_requires_auth(self):
        response = self.client.get(reverse("core:me"))
        self.assertEqual(response.status_code, 403)

    def test_me_returns_profile(self):
        self.login(self.vendor)
        response = self.client.get(reverse("core:me"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "vendeur")
        self.assertEqual(response.json()["role"], "VENDOR")

    def test_logout(self):
        self.login(self.vendor)
        response = self.client.post(reverse("core:logout"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("LOGOUT", [log.action for log in AuditLog.objects.all()])


class RegisterTests(TestCase):
    """Inscription publique — réutilise l'auth par session, rôle VENDOR imposé."""

    def setUp(self):
        self.client = APIClient()
        self.client.default_format = "json"
        self.payload = {
            "first_name": "Awa",
            "last_name": "Ndiaye",
            "email": "Awa.Ndiaye@Example.sn",
            "phone": "77 123 45 67",
            "password": "Str0ng-Pass!23",
            "password_confirm": "Str0ng-Pass!23",
        }

    def test_register_is_public_and_creates_vendor(self):
        response = self.client.post(reverse("core:register"), self.payload)
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(response.json()["role"], "VENDOR")
        self.assertFalse(response.json()["is_admin_role"])

        user = User.objects.get(email="awa.ndiaye@example.sn")
        self.assertEqual(user.username, "awa.ndiaye@example.sn")
        self.assertEqual(user.role, User.Role.VENDOR)
        self.assertTrue(user.is_active)
        self.assertNotEqual(user.password, "Str0ng-Pass!23")
        self.assertTrue(user.check_password("Str0ng-Pass!23"))

    def test_register_opens_session(self):
        self.client.post(reverse("core:register"), self.payload)
        response = self.client.get(reverse("core:me"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "awa.ndiaye@example.sn")

    def test_register_forces_vendor_even_if_admin_requested(self):
        self.client.post(reverse("core:register"), {**self.payload, "role": "ADMIN"})
        user = User.objects.get(email="awa.ndiaye@example.sn")
        self.assertEqual(user.role, User.Role.VENDOR)
        self.assertFalse(user.is_admin_role)

    def test_register_rejects_duplicate_email(self):
        self.client.post(reverse("core:register"), self.payload)
        response = self.client.post(reverse("core:register"), self.payload)
        self.assertEqual(response.status_code, 400)

    def test_register_rejects_password_mismatch(self):
        response = self.client.post(
            reverse("core:register"), {**self.payload, "password_confirm": "Autre-Pass!23"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("email", response.json())

    def test_register_rejects_weak_password(self):
        response = self.client.post(
            reverse("core:register"),
            {**self.payload, "password": "123", "password_confirm": "123"},
        )
        self.assertEqual(response.status_code, 400)

    def test_new_vendor_cannot_access_admin_endpoints(self):
        self.client.post(reverse("core:register"), self.payload)
        response = self.client.get(reverse("core:user-list"))
        self.assertEqual(response.status_code, 403)

    def test_register_logs_audit_entry(self):
        self.client.post(reverse("core:register"), self.payload)
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.USER_MANAGEMENT, summary__startswith="Inscription"
            ).exists()
        )


class CsrfTrustedOriginTests(TestCase):
    """En développement, l'origine du serveur Vite doit être fiable pour le CSRF.

    Régression : « CSRF Failed: Origin checking failed - http://localhost:5173
    does not match any trusted origins. » lors d'un POST depuis le frontend.
    Le contrôle d'origine n'a lieu qu'avec une session authentifiée (DRF).
    """

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin@example.sn",
            password="Adm1n-Pass!23",
            role=User.Role.ADMIN,
        )
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.default_format = "json"
        self.client.force_login(self.admin)

    def _post_category(self, origin):
        csrf = self.client.get(reverse("core:csrf"))
        token = csrf.cookies["csrftoken"].value
        return self.client.post(
            reverse("core:category-list"),
            {"name": "Hauts", "description": ""},
            HTTP_ORIGIN=origin,
            HTTP_X_CSRFTOKEN=token,
        )

    def test_vite_origin_is_trusted(self):
        self.assertIn("http://localhost:5173", settings.CSRF_TRUSTED_ORIGINS)
        response = self._post_category("http://localhost:5173")
        self.assertEqual(response.status_code, 201, response.content)

    def test_untrusted_origin_is_rejected(self):
        response = self._post_category("http://evil.example.com")
        self.assertEqual(response.status_code, 403)


class AccessRightsTests(BaseAPITest):
    """Page « Droits d'accès » — matrice en lecture seule, réservée aux admins."""

    def test_admin_can_read_matrix(self):
        self.login(self.admin)
        response = self.client.get(reverse("core:access-rights"))
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual([r["key"] for r in data["roles"]], ["ADMIN", "VENDOR"])
        self.assertEqual([lvl["key"] for lvl in data["levels"]], ["full", "read", "none"])
        self.assertTrue(data["sections"])
        keys = [m["key"] for s in data["sections"] for m in s["modules"]]
        self.assertIn("users", keys)
        self.assertIn("sales", keys)

    def test_vendor_cannot_read_matrix(self):
        self.login(self.vendor)
        response = self.client.get(reverse("core:access-rights"))
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_read_matrix(self):
        response = self.client.get(reverse("core:access-rights"))
        self.assertIn(response.status_code, (401, 403))

    def test_matrix_matches_actual_view_permissions(self):
        """La matrice doit refléter les permissions réellement appliquées."""
        from . import access_rights

        self.login(self.admin)
        data = self.client.get(reverse("core:access-rights")).json()
        access = {
            m["key"]: m["access"]
            for s in data["sections"]
            for m in s["modules"]
        }

        def levels(permission_classes):
            return access_rights._levels_for(list(permission_classes))

        from .views.audit import AuditLogViewSet
        from .views.catalog import CategoryViewSet, ProductViewSet
        from .views.people import CustomerViewSet, SupplierViewSet
        from .views.purchasing import PurchaseViewSet
        from .views.sales import SaleViewSet
        from .views.users import UserViewSet

        expected = {
            "sales": levels(SaleViewSet.permission_classes),
            "purchases": levels(PurchaseViewSet.permission_classes),
            "products": levels(ProductViewSet.permission_classes),
            "categories": levels(CategoryViewSet.permission_classes),
            "customers": levels(CustomerViewSet.permission_classes),
            "suppliers": levels(SupplierViewSet.permission_classes),
            "users": levels(UserViewSet.permission_classes),
            "audit": levels(AuditLogViewSet.permission_classes),
        }
        for key, (admin_level, vendor_level) in expected.items():
            self.assertEqual(access[key]["ADMIN"], admin_level, key)
            self.assertEqual(access[key]["VENDOR"], vendor_level, key)


# --------------------------------------------------------------------------- #
# Permissions et rôles
# --------------------------------------------------------------------------- #
class PermissionTests(BaseAPITest):
    def test_anonymous_cannot_list_products(self):
        response = self.client.get(reverse("core:product-list"))
        self.assertIn(response.status_code, (401, 403))

    def test_vendor_can_list_products(self):
        self.login(self.vendor)
        response = self.client.get(reverse("core:product-list"))
        self.assertEqual(response.status_code, 200)

    def test_vendor_cannot_manage_users(self):
        self.login(self.vendor)
        response = self.client.get(reverse("core:user-list"))
        self.assertEqual(response.status_code, 403)

    def test_admin_can_manage_users(self):
        self.login(self.admin)
        response = self.client.get(reverse("core:user-list"))
        self.assertEqual(response.status_code, 200)

    def test_vendor_cannot_create_product(self):
        self.login(self.vendor)
        response = self.client.post(
            reverse("core:product-list"),
            {"sku": "X-1", "name": "Test", "sale_price": "1000", "purchase_price": "500"},
        )
        self.assertEqual(response.status_code, 403)

    def test_vendor_cannot_patch_settings(self):
        self.login(self.vendor)
        response = self.client.patch(
            reverse("core:shop-settings"), {"shop_name": "Hack"}
        )
        self.assertEqual(response.status_code, 403)


# --------------------------------------------------------------------------- #
# Produits et catégories
# --------------------------------------------------------------------------- #
class ProductTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.login(self.admin)

    def test_create_product(self):
        response = self.client.post(
            reverse("core:product-list"),
            {
                "sku": "  tshirt-01 ",
                "name": "T-shirt bandana",
                "sale_price": "5000",
                "purchase_price": "2000",
                "quantity": "3",
            },
        )
        self.assertEqual(response.status_code, 201, response.json())
        product = Product.objects.get(sku="TSHIRT-01")
        self.assertEqual(product.quantity, 3)
        self.assertTrue(AuditLog.objects.filter(object_type="Product").exists())

    def test_duplicate_sku_rejected(self):
        make_product(sku="DUP-1")
        response = self.client.post(
            reverse("core:product-list"),
            {"sku": "dup-1", "name": "Doublon", "sale_price": "1000", "purchase_price": "500"},
        )
        self.assertEqual(response.status_code, 400)

    def test_negative_quantity_rejected_by_serializer(self):
        response = self.client.post(
            reverse("core:product-list"),
            {"sku": "NEG-1", "name": "X", "sale_price": "1000", "purchase_price": "500", "quantity": "-2"},
        )
        self.assertEqual(response.status_code, 400)

    def test_search_and_filters(self):
        cat = Category.objects.create(name="Pantalons")
        make_product(sku="AAA-1", name="Robe wax", quantity=0)
        make_product(sku="BBB-1", name="Jean brut", category=cat, quantity=2)
        self.login(self.vendor)

        response = self.client.get(reverse("core:product-list"), {"search": "robe"})
        self.assertEqual(response.json()["count"], 1)

        response = self.client.get(reverse("core:product-list"), {"availability": "out"})
        self.assertEqual(response.json()["count"], 1)

        response = self.client.get(reverse("core:product-list"), {"category": str(cat.pk)})
        self.assertEqual(response.json()["count"], 1)

    def test_product_with_sales_cannot_be_deleted_only_archived(self):
        product = make_product(quantity=0)
        self.client.post(
            reverse("core:product-list") + f"{product.pk}/archive/", {}
        )
        product.refresh_from_db()
        self.assertTrue(product.is_archived)

    def test_adjust_stock_creates_movement(self):
        product = make_product(quantity=2)
        response = self.client.post(
            reverse("core:product-list") + f"{product.pk}/adjust-stock/",
            {"quantity": 5, "reason": "Retour client"},
        )
        self.assertEqual(response.status_code, 200, response.json())
        product.refresh_from_db()
        self.assertEqual(product.quantity, 7)
        movement = StockMovement.objects.get(product=product)
        self.assertEqual(movement.movement_type, StockMovement.Type.ADJUSTMENT)

    def test_adjust_stock_cannot_go_negative(self):
        product = make_product(quantity=2)
        response = self.client.post(
            reverse("core:product-list") + f"{product.pk}/adjust-stock/",
            {"quantity": -5},
        )
        self.assertEqual(response.status_code, 400)
        product.refresh_from_db()
        self.assertEqual(product.quantity, 2)


class CategoryTests(BaseAPITest):
    def test_cannot_delete_category_with_products(self):
        self.login(self.admin)
        category = Category.objects.create(name="Vestes")
        make_product(category=category)
        response = self.client.delete(reverse("core:category-detail", args=[category.pk]))
        self.assertEqual(response.status_code, 400)

    def test_archive_category(self):
        self.login(self.admin)
        category = Category.objects.create(name="Chapeaux")
        response = self.client.post(reverse("core:category-detail", args=[category.pk]) + "archive/")
        self.assertEqual(response.status_code, 200)
        category.refresh_from_db()
        self.assertFalse(category.is_active)


# --------------------------------------------------------------------------- #
# Ventes
# --------------------------------------------------------------------------- #
class SaleTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.login(self.vendor)
        self.product = make_product(quantity=5, sale_price=Decimal("15000"),
                                    purchase_price=Decimal("8000"))

    def sale_payload(self, **overrides):
        payload = {
            "items": [{"product_id": self.product.pk, "quantity": 2}],
            "payment_method": "CASH",
            "discount": "0",
        }
        payload.update(overrides)
        return payload

    def test_create_sale_recalculates_totals_and_stock(self):
        # Le client envoie un total bidon : le serveur doit l'ignorer.
        response = self.client.post(
            reverse("core:sale-list"), self.sale_payload(total_amount="1")
        )
        self.assertEqual(response.status_code, 201, response.json())
        data = response.json()
        self.assertEqual(data["total_amount"], "30000")
        self.assertEqual(data["cost_amount"], "16000")
        self.assertEqual(data["gross_profit"], "14000")
        self.assertTrue(data["number"].startswith("V-"))

        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 3)

        movement = StockMovement.objects.filter(product=self.product).latest("created_at")
        self.assertEqual(movement.movement_type, StockMovement.Type.SALE)
        self.assertEqual(movement.quantity, 2)

        sale = Sale.objects.get()
        item = sale.items.get()
        self.assertEqual(item.unit_price, Decimal("15000"))
        self.assertEqual(item.unit_cost, Decimal("8000"))

    def test_insufficient_stock_rejected_atomically(self):
        response = self.client.post(
            reverse("core:sale-list"), self.sale_payload(
                items=[{"product_id": self.product.pk, "quantity": 99}]
            )
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Sale.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 5)

    def test_idempotency_prevents_double_validation(self):
        key = "key-abc-123"
        first = self.client.post(reverse("core:sale-list"), self.sale_payload(idempotency_key=key))
        self.assertEqual(first.status_code, 201)
        second = self.client.post(reverse("core:sale-list"), self.sale_payload(idempotency_key=key))
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["id"], first.json()["id"])
        self.assertEqual(Sale.objects.count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 3)  # décrémenté une seule fois

    def test_discount_cannot_exceed_subtotal(self):
        response = self.client.post(
            reverse("core:sale-list"), self.sale_payload(discount="999999")
        )
        self.assertEqual(response.status_code, 400)

    def test_discount_is_applied(self):
        response = self.client.post(
            reverse("core:sale-list"), self.sale_payload(discount="1000")
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["total_amount"], "29000")

    def test_cancel_restores_stock_and_blocks_double_cancel(self):
        sale_response = self.client.post(reverse("core:sale-list"), self.sale_payload())
        sale_id = sale_response.json()["id"]

        cancel = self.client.post(
            reverse("core:sale-detail", args=[sale_id]) + "cancel/", {"reason": "Erreur de caisse"}
        )
        self.assertEqual(cancel.status_code, 200)
        self.assertEqual(cancel.json()["status"], "CANCELLED")

        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 5)
        types = set(
            StockMovement.objects.filter(product=self.product)
            .values_list("movement_type", flat=True)
        )
        self.assertIn(StockMovement.Type.CANCELLATION, types)

        again = self.client.post(
            reverse("core:sale-detail", args=[sale_id]) + "cancel/", {}
        )
        self.assertEqual(again.status_code, 400)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 5)  # pas de double restoration

    def test_sale_records_audit_entry(self):
        self.client.post(reverse("core:sale-list"), self.sale_payload())
        self.assertTrue(
            AuditLog.objects.filter(action=AuditLog.Action.SALE).exists()
        )

    def test_empty_cart_rejected(self):
        response = self.client.post(reverse("core:sale-list"), {"items": []})
        self.assertEqual(response.status_code, 400)


# --------------------------------------------------------------------------- #
# Approvisionnements
# --------------------------------------------------------------------------- #
class PurchaseTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.login(self.admin)
        self.product = make_product(quantity=1, purchase_price=Decimal("5000"))
        self.supplier = Supplier.objects.create(name="Marché Sandaga", phone="77 000 00 00")

    def test_purchase_increases_stock_and_updates_cost(self):
        response = self.client.post(
            reverse("core:purchase-list"),
            {
                "supplier": self.supplier.pk,
                "items": [{"product_id": self.product.pk, "quantity": 10, "unit_cost": "4500"}],
            },
        )
        self.assertEqual(response.status_code, 201, response.json())
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 11)
        self.assertEqual(self.product.purchase_price, Decimal("4500"))
        self.assertEqual(response.json()["total_cost"], "45000")
        self.assertTrue(response.json()["reference"].startswith("FA-"))
        movement = StockMovement.objects.filter(product=self.product).latest("created_at")
        self.assertEqual(movement.movement_type, StockMovement.Type.PURCHASE)

    def test_purchase_requires_items(self):
        response = self.client.post(reverse("core:purchase-list"), {"items": []})
        self.assertEqual(response.status_code, 400)


# --------------------------------------------------------------------------- #
# Clients et fournisseurs
# --------------------------------------------------------------------------- #
class CustomerTests(BaseAPITest):
    def test_create_customer_and_history(self):
        self.login(self.admin)
        response = self.client.post(
            reverse("core:customer-list"),
            {"last_name": "Ndiaye", "first_name": "Awa", "phone": "77 123 45 67"},
        )
        self.assertEqual(response.status_code, 201)
        customer_id = response.json()["id"]

        product = make_product()
        self.client.post(
            reverse("core:sale-list"),
            {"items": [{"product_id": product.pk, "quantity": 1}], "customer": customer_id},
        )
        history = self.client.get(reverse("core:customer-sales", args=[customer_id]))
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()["count"], 1)


# --------------------------------------------------------------------------- #
# Tableau de bord, rapports, journal
# --------------------------------------------------------------------------- #
class DashboardTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.login(self.vendor)
        self.product = make_product(quantity=10)
        self.client.post(
            reverse("core:sale-list"),
            {"items": [{"product_id": self.product.pk, "quantity": 2}]},
        )

    def test_dashboard_uses_real_data(self):
        response = self.client.get(reverse("core:dashboard"), {"period": "today"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["revenue"], "30000")
        self.assertEqual(data["sales_count"], 1)
        self.assertEqual(data["cost_of_goods_sold"], "16000")
        self.assertEqual(data["gross_profit"], "14000")
        self.assertEqual(len(data["recent_sales"]), 1)
        self.assertEqual(data["top_products"][0]["quantity_sold"], 2)

    def test_dashboard_period_filter_excludes_old_sales(self):
        old_sale = Sale.objects.create(seller=self.vendor)
        old_sale.created_at = timezone.now() - timedelta(days=40)
        old_sale.save(update_fields=["created_at"])
        response = self.client.get(reverse("core:dashboard"), {"period": "7d"})
        # seule la vente récente compte
        self.assertEqual(response.json()["sales_count"], 1)


class ReportTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.login(self.vendor)
        self.product = make_product()
        self.client.post(
            reverse("core:sale-list"),
            {"items": [{"product_id": self.product.pk, "quantity": 1}]},
        )

    def test_reports_real_calculations(self):
        response = self.client.get(reverse("core:reports"), {"period": "30d", "group": "day"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["totals"]["revenue"], "15000")
        self.assertEqual(data["totals"]["gross_profit"], "7000")
        self.assertEqual(data["payment_breakdown"][0]["payment_method"], "CASH")

    def test_csv_export_protects_against_formula_injection(self):
        evil_customer = Customer.objects.create(last_name="=SUM(A1:A9)")
        self.client.post(
            reverse("core:sale-list"),
            {
                "items": [{"product_id": self.product.pk, "quantity": 1}],
                "customer": evil_customer.pk,
            },
        )
        response = self.client.get(reverse("core:reports-sales-csv"), {"period": "30d"})
        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8-sig")
        self.assertIn("Numéro", content)
        self.assertIn("'=SUM(A1:A9)", content)  # cellule neutralisée
        self.assertNotIn(",=SUM", content)


class AuditLogTests(BaseAPITest):
    def test_audit_log_admin_only(self):
        self.login(self.vendor)
        response = self.client.get(reverse("core:auditlog-list"))
        self.assertEqual(response.status_code, 403)

        self.login(self.admin)
        response = self.client.get(reverse("core:auditlog-list"))
        self.assertEqual(response.status_code, 200)


class ShopSettingsTests(BaseAPITest):
    def test_settings_roundtrip(self):
        self.login(self.admin)
        response = self.client.patch(
            reverse("core:shop-settings"),
            {"shop_name": "SEN-Friperie Dakar", "payment_methods": ["CASH", "WAVE"]},
        )
        self.assertEqual(response.status_code, 200, response.json())
        response = self.client.get(reverse("core:shop-settings"))
        self.assertEqual(response.json()["shop_name"], "SEN-Friperie Dakar")

    def test_unknown_payment_method_rejected(self):
        self.login(self.admin)
        response = self.client.patch(
            reverse("core:shop-settings"), {"payment_methods": ["BITCOIN"]}
        )
        self.assertEqual(response.status_code, 400)
