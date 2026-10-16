from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    AuditLog,
    Category,
    Customer,
    Product,
    Purchase,
    PurchaseItem,
    Sale,
    SaleItem,
    ShopSettings,
    StockMovement,
    Supplier,
    User,
)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "display_name", "role", "is_active", "last_login")
    list_filter = ("role", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        ("SEN-Friperie", {"fields": ("role", "phone")}),
    )


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "sku", "name", "category", "size", "condition",
        "sale_price", "purchase_price", "quantity", "is_archived",
    )
    list_filter = ("is_archived", "condition", "size", "category")
    search_fields = ("sku", "name")


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("product", "movement_type", "quantity", "user", "created_at")
    list_filter = ("movement_type",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("last_name", "first_name", "phone", "email")
    search_fields = ("last_name", "first_name", "phone", "email")


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "email")
    search_fields = ("name",)


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 1


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ("reference", "supplier", "date", "total_cost", "created_by")
    inlines = (PurchaseItemInline,)


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ("product", "product_name", "product_sku", "quantity", "unit_price", "unit_cost")


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("number", "customer", "seller", "payment_method", "total_amount", "status", "created_at")
    list_filter = ("status", "payment_method")
    inlines = (SaleItemInline,)
    readonly_fields = ("number", "total_amount", "cost_amount")


@admin.register(ShopSettings)
class ShopSettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not ShopSettings.objects.exists()


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "object_type", "summary")
    list_filter = ("action", "object_type")
    search_fields = ("summary", "object_id")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
