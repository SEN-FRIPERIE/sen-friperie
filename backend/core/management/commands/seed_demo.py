"""Jeu de données de démonstration — À UTILISER UNIQUEMENT EN DÉVELOPPEMENT.

Refuse de s'exécuter si DEBUG est désactivé, pour ne jamais polluer la production.
Usage : python manage.py seed_demo
"""

from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import Category, Customer, Product, ShopSettings, Supplier, User


class Command(BaseCommand):
    help = "Insère des données de démonstration (développement uniquement)."

    def handle(self, *args, **options):
        from django.conf import settings

        if not settings.DEBUG:
            raise CommandError(
                "Commande refusée : elle n'est autorisée qu'avec DEBUG=True "
                "(environnement de développement)."
            )

        with transaction.atomic():
            admin, created = User.objects.get_or_create(
                username="demo_admin",
                defaults={
                    "role": User.Role.ADMIN,
                    "first_name": "Admin",
                    "last_name": "Démo",
                },
            )
            if created:
                admin.set_password("demo-admin-2026")
                admin.save()
                self.stdout.write("Utilisateur demo_admin créé (mot de passe : demo-admin-2026)")

            vendor, created = User.objects.get_or_create(
                username="demo_vendeur",
                defaults={
                    "role": User.Role.VENDOR,
                    "first_name": "Fatou",
                    "last_name": "Sow",
                },
            )
            if created:
                vendor.set_password("demo-vendeur-2026")
                vendor.save()
                self.stdout.write("Utilisateur demo_vendeur créé (mot de passe : demo-vendeur-2026)")

            categories = {}
            for name, desc in [
                ("Hauts", "T-shirts, chemises, pulls"),
                ("Bas", "Jeans, pantalons, jupes"),
                ("Vestes", "Blousons, manteaux"),
                ("Robes", "Robes et ensembles"),
                ("Accessoires", "Sacs, ceintures, chapeaux"),
            ]:
                cat, _ = Category.objects.get_or_create(name=name, defaults={"description": desc})
                categories[name] = cat

            products = [
                ("Haut", "T-shirt coton bandana", "Hauts", "M", "Bleu", "GOOD", 3000, 8000, 6, 2),
                ("Haut", "Chemise hawaïenne vintage", "Hauts", "L", "Floral", "VERY_GOOD", 5000, 12000, 3, 1),
                ("Bas", "Jean brut Levi's 501", "Bas", "M", "Indigo", "GOOD", 4000, 15000, 4, 1),
                ("Bas", "Pantalon cargo beige", "Bas", "L", "Beige", "NEW", 6000, 18000, 2, 1),
                ("Veste", "Blouson en cuir", "Vestes", "XL", "Noir", "VERY_GOOD", 10000, 35000, 1, 1),
                ("Robe", "Robe wax colorée", "Robes", "S", "Multicolore", "GOOD", 4500, 14000, 3, 1),
                ("Accessoire", "Sac à main tressé", "Accessoires", "UNIQUE", "Marron", "GOOD", 2500, 9000, 0, 1),
            ]
            for prefix, name, cat, size, color, condition, cost, price, qty, threshold in products:
                sku = f"DEMO-{prefix[:2].upper()}{Category.objects.get(name=cat).pk:02d}{name[:3].upper().replace(' ', '')}"
                Product.objects.get_or_create(
                    sku=sku.upper(),
                    defaults={
                        "name": name,
                        "category": categories[cat],
                        "size": size,
                        "color": color,
                        "condition": condition,
                        "purchase_price": Decimal(cost),
                        "sale_price": Decimal(price),
                        "quantity": qty,
                        "low_stock_threshold": threshold,
                    },
                )

            Customer.objects.get_or_create(
                last_name="Diop", defaults={"first_name": "Moussa", "phone": "77 000 00 01"}
            )
            Customer.objects.get_or_create(
                last_name="Fall", defaults={"first_name": "Aissatou", "phone": "78 000 00 02"}
            )
            Supplier.objects.get_or_create(
                name="Fournisseur démo Sandaga", defaults={"phone": "76 000 00 03"}
            )

            ShopSettings.get()

        self.stdout.write(self.style.SUCCESS("Données de démonstration insérées."))
