from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = (
        "Affiche la base de donnees utilisee par Django et teste la connexion. "
        "Commande en lecture seule : aucune base ni donnee n'est modifiee."
    )

    def handle(self, *args, **options):
        conf = settings.DATABASES["default"]
        engine = conf.get("ENGINE", "")
        is_postgres = engine.endswith("postgresql")

        self.stdout.write(self.style.MIGRATE_HEADING("Configuration Django"))
        self.stdout.write(f"  ENGINE : {engine}")
        self.stdout.write(f"  NAME   : {conf.get('NAME', '')}")
        if is_postgres:
            options = conf.get("OPTIONS", {})
            self.stdout.write(f"  HOST   : {conf.get('HOST') or '(local)'}")
            self.stdout.write(f"  PORT   : {conf.get('PORT') or '5432 (defaut)'}")
            self.stdout.write(f"  USER   : {conf.get('USER') or '(absent)'}")
            self.stdout.write(f"  sslmode: {options.get('sslmode', '(non defini)')}")
        self.stdout.write(
            f"  PASSWORD : {'defini' if conf.get('PASSWORD') else 'absent'}"
        )

        self.stdout.write("")
        self.stdout.write("Test de connexion...")
        try:
            connection.ensure_connection()
        except Exception as exc:  # noqa: BLE001 - on affiche l'erreur sans masquer
            self.stderr.write(self.style.ERROR(f"Connexion ECHOUEE : {exc}"))
            raise SystemExit(1)

        with connection.cursor() as cursor:
            if is_postgres:
                cursor.execute("SELECT version()")
            else:
                cursor.execute("SELECT sqlite_version()")
            version = cursor.fetchone()[0]

        label = "PostgreSQL" if is_postgres else "SQLite"
        self.stdout.write(self.style.SUCCESS("Connexion OK."))
        self.stdout.write(f"  {label} : {version}")
