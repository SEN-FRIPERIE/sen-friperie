"""
Django settings for SEN-Friperie.

Configuration via variables d'aucun secret n'est inscrit en dur :
renseignez un fichier ``backend/.env`` (voir ``.env.example``).
"""

import os
import secrets
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Charge backend/.env s'il existe.
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: str = "false") -> bool:
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# SECURITY WARNING: keep the secret key used in production secret!
# En production, SECRET_KEY doit être défini. En local, une clé éphémère
# aléatoire est générée à chaque démarrage pour éviter tout secret en dur.
SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_urlsafe(50)

DEBUG = env_bool("DEBUG", "true")

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Tiers
    "rest_framework",
    "corsheaders",
    # Applications locales
    "core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases
#
# Règle : SQLite n'est utilisé QUE si DEV_USE_SQLITE=true est défini
# explicitement (développement / tests hors ligne). Sans DATABASE_URL ni
# DEV_USE_SQLITE, Django refuse de démarrer plutôt que de basculer silencieusement.
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
USE_SQLITE_DEV = env_bool("DEV_USE_SQLITE", "false")

if USE_SQLITE_DEV:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    if not DATABASE_URL:
        raise ImproperlyConfigured(
            "DATABASE_URL n'est pas défini. Renseignez backend/.env "
            "(voir .env.example) ou activez DEV_USE_SQLITE=true pour un "
            "développement local hors PostgreSQL."
        )
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=int(os.environ.get("DB_CONN_MAX_AGE", "600")),
            conn_health_checks=True,
        )
    }

# Options spécifiques à PostgreSQL (SSL + pooler Supabase).
_is_postgres = DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"

if _is_postgres:
    _options = DATABASES["default"].setdefault("OPTIONS", {})
    if env_bool("DB_SSL_REQUIRE", "true"):
        # Supabase impose une connexion chiffrée.
        _options.setdefault("sslmode", "require")
    _options.setdefault(
        "connect_timeout", int(os.environ.get("DB_CONNECT_TIMEOUT", "10"))
    )
    if env_bool("DB_DISABLE_PREPARED_STATEMENTS", "false"):
        # Requis avec le pooler Supabase en mode "transaction" (port 6543),
        # qui ne supporte pas les requêtes préparées.
        _options["prepare_threshold"] = None


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "fr"
TIME_ZONE = "Africa/Dakar"
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Utilisateur personnalisé (rôle administrateur / vendeur).
AUTH_USER_MODEL = "core.User"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "core.exceptions.api_exception_handler",
}

# CORS — origines autorisées pour le frontend Vite en développement.
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CORS_ALLOW_CREDENTIALS = True

# CSRF — origines autorisées à envoyer des requêtes POST authentifiées par
# session (nécessaire quand le frontend est servi depuis une autre origine).
# En développement, les origines du serveur Vite sont fiables par défaut ;
# en production, renseignez explicitement CSRF_TRUSTED_ORIGINS.
_disable_csrf_origin_default = (
    "http://localhost:5173,http://127.0.0.1:5173" if DEBUG else ""
)
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", _disable_csrf_origin_default)
