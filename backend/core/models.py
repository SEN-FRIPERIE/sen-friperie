"""Modèles métier de SEN-Friperie.

Toutes les montées en plage sont en FCFA (décimales = 0).
Les ventes conservent des instantanés de prix et de coût pour ne jamais
devenir incohérentes si un produit est modifié ou archivé ensuite.
"""

from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    updated_at = models.DateTimeField("modifié le", auto_now=True)

    class Meta:
        abstract = True


# --------------------------------------------------------------------------- #
# Utilisateurs
# --------------------------------------------------------------------------- #
class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrateur"
        VENDOR = "VENDOR", "Vendeur"

    role = models.CharField(
        "rôle", max_length=10, choices=Role.choices, default=Role.VENDOR
    )
    phone = models.CharField("téléphone", max_length=30, blank=True)

    class Meta:
        verbose_name = "utilisateur"
        ordering = ["username"]

    @property
    def is_admin_role(self) -> bool:
        return self.role == self.Role.ADMIN or self.is_staff

    @property
    def display_name(self) -> str:
        full = f"{self.first_name} {self.last_name}".strip()
        return full or self.username

    def __str__(self) -> str:
        return f"{self.display_name} ({self.get_role_display()})"


# --------------------------------------------------------------------------- #
# Catalogue
# --------------------------------------------------------------------------- #
class Category(TimeStampedModel):
    name = models.CharField("nom", max_length=100, unique=True)
    description = models.TextField("description", blank=True)
    is_active = models.BooleanField("active", default=True)

    class Meta:
        verbose_name = "catégorie"
        ordering = ["name"]

    @property
    def product_count(self) -> int:
        return self.products.filter(is_archived=False).count()

    def __str__(self) -> str:
        return self.name


class Product(TimeStampedModel):
    class Condition(models.TextChoices):
        NEW = "NEW", "Neuf"
        VERY_GOOD = "VERY_GOOD", "Très bon état"
        GOOD = "GOOD", "Bon état"
        FAIR = "FAIR", "État satisfaisant"

    class Size(models.TextChoices):
        XS = "XS", "XS"
        S = "S", "S"
        M = "M", "M"
        L = "L", "L"
        XL = "XL", "XL"
        XXL = "XXL", "XXL"
        UNIQUE = "UNIQUE", "Taille unique"

    sku = models.CharField("référence", max_length=40, unique=True)
    name = models.CharField("nom", max_length=200)
    description = models.TextField("description", blank=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        verbose_name="catégorie",
        null=True,
        blank=True,
    )
    size = models.CharField(
        "taille", max_length=10, choices=Size.choices, default=Size.UNIQUE
    )
    color = models.CharField("couleur", max_length=60, blank=True)
    condition = models.CharField(
        "état", max_length=12, choices=Condition.choices, default=Condition.GOOD
    )
    purchase_price = models.DecimalField(
        "prix d'achat (FCFA)",
        max_digits=12,
        decimal_places=0,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    sale_price = models.DecimalField(
        "prix de vente (FCFA)",
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    quantity = models.PositiveIntegerField("quantité en stock", default=0)
    low_stock_threshold = models.PositiveIntegerField("seuil d'alerte", default=1)
    image_url = models.URLField("URL de l'image", blank=True)
    is_archived = models.BooleanField("archivé", default=False)

    class Meta:
        verbose_name = "produit"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["category", "is_archived"]),
        ]

    def clean(self):
        if self.sku:
            self.sku = self.sku.strip().upper()
        if self.sale_price is not None and self.sale_price < 0:
            raise ValidationError({"sale_price": "Le prix de vente ne peut pas être négatif."})
        if self.purchase_price is not None and self.purchase_price < 0:
            raise ValidationError(
                {"purchase_price": "Le prix d'achat ne peut pas être négatif."}
            )

    def save(self, *args, **kwargs):
        self.full_clean(exclude=["category"])
        return super().save(*args, **kwargs)

    @property
    def is_low_stock(self) -> bool:
        return 0 < self.quantity <= self.low_stock_threshold

    @property
    def is_out_of_stock(self) -> bool:
        return self.quantity == 0

    def __str__(self) -> str:
        return f"{self.sku} — {self.name}"


class StockMovement(TimeStampedModel):
    class Type(models.TextChoices):
        PURCHASE = "PURCHASE", "Entrée (approvisionnement)"
        SALE = "SALE", "Sortie (vente)"
        ADJUSTMENT = "ADJUSTMENT", "Ajustement manuel"
        RETURN = "RETURN", "Retour client"
        CANCELLATION = "CANCELLATION", "Annulation de vente"

    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="movements", verbose_name="produit"
    )
    movement_type = models.CharField("type", max_length=12, choices=Type.choices)
    quantity = models.PositiveIntegerField("quantité", validators=[MinValueValidator(1)])
    unit_cost = models.DecimalField(
        "coût unitaire (FCFA)",
        max_digits=12,
        decimal_places=0,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    reason = models.CharField("motif", max_length=255, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
        verbose_name="utilisateur",
    )
    sale = models.ForeignKey(
        "Sale", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="stock_movements", verbose_name="vente",
    )
    purchase = models.ForeignKey(
        "Purchase", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="stock_movements", verbose_name="approvisionnement",
    )

    class Meta:
        verbose_name = "mouvement de stock"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["product", "created_at"])]

    @property
    def signed_quantity(self) -> int:
        if self.movement_type in (self.Type.PURCHASE, self.Type.RETURN, self.Type.CANCELLATION):
            return self.quantity
        return -self.quantity

    def __str__(self) -> str:
        return f"{self.get_movement_type_display()} {self.quantity} × {self.product}"


# --------------------------------------------------------------------------- #
# Tiers
# --------------------------------------------------------------------------- #
class Customer(TimeStampedModel):
    first_name = models.CharField("prénom", max_length=100, blank=True)
    last_name = models.CharField("nom", max_length=100)
    phone = models.CharField("téléphone", max_length=30, blank=True)
    email = models.EmailField("e-mail", blank=True)
    address = models.CharField("adresse", max_length=255, blank=True)
    notes = models.TextField("notes", blank=True)

    class Meta:
        verbose_name = "client"
        ordering = ["last_name", "first_name"]

    @property
    def display_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self) -> str:
        return self.display_name


class Supplier(TimeStampedModel):
    name = models.CharField("nom", max_length=200, unique=True)
    phone = models.CharField("téléphone", max_length=30, blank=True)
    email = models.EmailField("e-mail", blank=True)
    address = models.CharField("adresse", max_length=255, blank=True)
    notes = models.TextField("notes", blank=True)

    class Meta:
        verbose_name = "fournisseur"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


# --------------------------------------------------------------------------- #
# Approvisionnements
# --------------------------------------------------------------------------- #
class Purchase(TimeStampedModel):
    reference = models.CharField("référence", max_length=20, unique=True, blank=True)
    supplier = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="purchases", verbose_name="fournisseur",
    )
    date = models.DateField("date", default=timezone.localdate)
    notes = models.TextField("notes", blank=True)
    total_cost = models.DecimalField(
        "coût total (FCFA)", max_digits=14, decimal_places=0, default=Decimal("0")
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="purchases", verbose_name="créé par",
    )

    class Meta:
        verbose_name = "approvisionnement"
        ordering = ["-date", "-created_at"]

    def save(self, *args, **kwargs):
        creating = self._state.adding
        super().save(*args, **kwargs)
        if creating and not self.reference:
            self.reference = f"FA-{self.pk:06d}"
            super().save(update_fields=["reference"])

    def __str__(self) -> str:
        return self.reference or f"Approvisionnement #{self.pk}"


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(
        Purchase, on_delete=models.CASCADE, related_name="items", verbose_name="approvisionnement"
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="purchase_items", verbose_name="produit"
    )
    quantity = models.PositiveIntegerField("quantité", validators=[MinValueValidator(1)])
    unit_cost = models.DecimalField(
        "coût unitaire (FCFA)", max_digits=12, decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )

    class Meta:
        verbose_name = "ligne d'approvisionnement"

    @property
    def line_total(self) -> Decimal:
        return self.quantity * self.unit_cost

    def __str__(self) -> str:
        return f"{self.quantity} × {self.product} @ {self.unit_cost}"


# --------------------------------------------------------------------------- #
# Ventes
# --------------------------------------------------------------------------- #
class Sale(TimeStampedModel):
    class Status(models.TextChoices):
        COMPLETED = "COMPLETED", "Validée"
        CANCELLED = "CANCELLED", "Annulée"

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Espèces"
        WAVE = "WAVE", "Wave"
        ORANGE_MONEY = "ORANGE_MONEY", "Orange Money"
        MOOV_MONEY = "MOOV_MONEY", "Moov Money"
        CARD = "CARD", "Carte bancaire"
        OTHER = "OTHER", "Autre"

    number = models.CharField("numéro", max_length=20, unique=True, blank=True)
    customer = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="sales", verbose_name="client",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="sales", verbose_name="vendeur",
    )
    payment_method = models.CharField(
        "mode de paiement", max_length=20, choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
    )
    discount = models.DecimalField(
        "remise (FCFA)", max_digits=12, decimal_places=0,
        default=Decimal("0"), validators=[MinValueValidator(Decimal("0"))],
    )
    total_amount = models.DecimalField(
        "total (FCFA)", max_digits=14, decimal_places=0, default=Decimal("0")
    )
    cost_amount = models.DecimalField(
        "coût des marchandises vendues (FCFA)",
        max_digits=14, decimal_places=0, default=Decimal("0"),
    )
    status = models.CharField(
        "statut", max_length=12, choices=Status.choices, default=Status.COMPLETED
    )
    cancellation_reason = models.CharField("motif d'annulation", max_length=255, blank=True)
    cancelled_at = models.DateTimeField("annulée le", null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cancelled_sales", verbose_name="annulée par",
    )
    idempotency_key = models.CharField(
        "clé d'idempotence", max_length=64, unique=True, null=True, blank=True
    )

    class Meta:
        verbose_name = "vente"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["seller", "created_at"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def save(self, *args, **kwargs):
        creating = self._state.adding
        super().save(*args, **kwargs)
        if creating and not self.number:
            self.number = f"V-{self.pk:06d}"
            super().save(update_fields=["number"])

    @property
    def gross_profit(self) -> Decimal:
        return self.total_amount - self.cost_amount

    def __str__(self) -> str:
        return self.number or f"Vente #{self.pk}"


class SaleItem(models.Model):
    sale = models.ForeignKey(
        Sale, on_delete=models.CASCADE, related_name="items", verbose_name="vente"
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="sale_items", verbose_name="produit"
    )
    product_name = models.CharField("nom du produit", max_length=200)
    product_sku = models.CharField("référence produit", max_length=40)
    quantity = models.PositiveIntegerField("quantité", validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(
        "prix unitaire (FCFA)", max_digits=12, decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    unit_cost = models.DecimalField(
        "coût unitaire (FCFA)", max_digits=12, decimal_places=0,
        default=Decimal("0"), validators=[MinValueValidator(Decimal("0"))],
    )

    class Meta:
        verbose_name = "ligne de vente"

    @property
    def line_total(self) -> Decimal:
        return self.quantity * self.unit_price

    def __str__(self) -> str:
        return f"{self.quantity} × {self.product_name} @ {self.unit_price}"


# --------------------------------------------------------------------------- #
# Paramètres de la boutique
# --------------------------------------------------------------------------- #
class ShopSettings(models.Model):
    """Réglages de la boutique (singleton : pk=1)."""

    shop_name = models.CharField("nom de la boutique", max_length=200, default="SEN-Friperie")
    phone = models.CharField("téléphone", max_length=30, blank=True)
    email = models.EmailField("e-mail", blank=True)
    address = models.CharField("adresse", max_length=255, blank=True)
    currency = models.CharField("devise", max_length=10, default="FCFA")
    default_low_stock_threshold = models.PositiveIntegerField(
        "seuil d'alerte par défaut", default=1
    )
    receipt_header = models.TextField("en-tête du reçu", blank=True)
    receipt_footer = models.TextField("pied de reçu", blank=True)
    payment_methods = models.JSONField(
        "modes de paiement actifs",
        default=list,
        blank=True,
        help_text="Liste de codes : CASH, WAVE, ORANGE_MONEY, MOOV_MONEY, CARD, OTHER",
    )

    class Meta:
        verbose_name = "paramètres de la boutique"
        verbose_name_plural = "paramètres de la boutique"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
        ShopSettings.objects.exclude(pk=1).delete()

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def get(cls) -> "ShopSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self) -> str:
        return self.shop_name


# --------------------------------------------------------------------------- #
# Journal d'activité
# --------------------------------------------------------------------------- #
class AuditLog(models.Model):
    class Action(models.TextChoices):
        LOGIN = "LOGIN", "Connexion"
        LOGOUT = "LOGOUT", "Déconnexion"
        CREATE = "CREATE", "Création"
        UPDATE = "UPDATE", "Modification"
        DELETE = "DELETE", "Suppression"
        ARCHIVE = "ARCHIVE", "Archivage"
        STOCK_IN = "STOCK_IN", "Entrée de stock"
        STOCK_OUT = "STOCK_OUT", "Sortie de stock"
        SALE = "SALE", "Vente"
        SALE_CANCEL = "SALE_CANCEL", "Annulation de vente"
        PURCHASE = "PURCHASE", "Approvisionnement"
        USER_MANAGEMENT = "USER_MANAGEMENT", "Gestion d'utilisateur"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="audit_logs", verbose_name="utilisateur",
    )
    action = models.CharField("action", max_length=20, choices=Action.choices)
    object_type = models.CharField("type d'objet", max_length=50)
    object_id = models.CharField("identifiant d'objet", max_length=50, blank=True)
    summary = models.CharField("résumé", max_length=255)
    created_at = models.DateTimeField("date", auto_now_add=True)

    class Meta:
        verbose_name = "entrée du journal"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["created_at"])]

    def __str__(self) -> str:
        return f"{self.action} — {self.summary}"
