# SEN-Friperie

Application web de gestion d'une boutique de friperie (vêtements de seconde
main) : catalogue, caisse, ventes, approvisionnements, clients, fournisseurs,
rapports et gestion des utilisateurs.

- **Backend** : Django 5 + Django REST Framework (API JSON, sessions + CSRF)
- **Frontend** : React 19 + Vite + React Router (interface en français)
- **Base de données** : PostgreSQL (Supabase) en production, SQLite en
  développement hors ligne
- **Devise** : FCFA (montants entiers)

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Arborescence](#arborescence)
- [Prérequis](#prérequis)
- [Démarrage rapide](#démarrage-rapide)
- [Configuration](#configuration)
- [Base de données](#base-de-données)
- [Comptes et rôles](#comptes-et-rôles)
- [Mode démonstration](#mode-démonstration)
- [Tests](#tests)
- [Build et déploiement](#build-et-déploiement)
- [Référence de l'API](#référence-de-lapi)
- [Bonnes pratiques et sécurité](#bonnes-pratiques-et-sécurité)

---

## Fonctionnalités

- **Tableau de bord** : chiffre d'affaires, bénéfice brut estimé, produits en
  stock, alertes de stock bas, ventes récentes.
- **Caisse (POS)** : recherche produit, panier, remise, modes de paiement,
  encaissement transactionnel avec décrément du stock côté serveur.
- **Produits / Catégories** : création, modification, archivage, ajustement du
  stock (avec traçage des mouvements).
- **Approvisionnements** : réception de marchandise ; le stock et le coût
  d'achat sont mis à jour automatiquement.
- **Ventes** : liste filtrable, détail, reçu imprimable, annulation (statut
  `CANCELLED` + restauration du stock, jamais de suppression).
- **Clients / Fournisseurs** : répertoire et historique d'achats.
- **Rapports** : ventes par jour/semaine/mois, modes de paiement, produits les
  plus vendus, valeur du stock, export CSV des ventes.
- **Utilisateurs** : comptes et rôles (administrateur / vendeur).
- **Droits d'accès** : matrice en lecture seule des droits par rôle (qui peut
  faire quoi), dérivée des permissions réellement appliquées par l'API.
- **Journal d'activité** : trace des événements importants.
- **Paramètres boutique** : coordonnées, en-tête/pied de reçu, modes de
  paiement actifs.

### Règles métier clés

- Les **totaux d'une vente sont toujours recalculés par le serveur** (le client
  n'impose pas les prix).
- L'encaissement est **idempotent** : une clé `idempotency_key` unique évite les
  doublons en cas de double clic ou de nouvelle tentative réseau.
- **Annulation** : la vente passe en `CANCELLED`, le stock est restauré, un
  mouvement de stock `CANCELLATION` est créé. Aucune donnée n'est supprimée.
- Chaque ligne de vente conserve un **instantané du prix de vente et du coût**
  au moment de l'achat (les marges passées restent exactes).
- Le stock déclenche une **alerte** quand il atteint le seuil bas du produit.

---

## Arborescence

```
SEN-Friperie/
├─ backend/
│  ├─ config/            # settings.py, urls.py, wsgi.py
│  ├─ core/
│  │  ├─ models.py       # domaine métier (User, Product, Sale, ...)
│  │  ├─ serializers/    # sérialiseurs DRF
│  │  ├─ views/          # vues / ViewSets de l'API
│  │  ├─ services/       # logique transactionnelle (ventes, achats)
│  │  ├─ management/commands/seed_demo.py
│  │  ├─ migrations/0001_initial.py
│  │  ├─ urls.py
│  │  └─ tests.py        # suite de tests
│  ├─ .env.example       # modèle de configuration (valeurs fictives)
│  ├─ requirements.txt
│  └─ manage.py
├─ frontend/
│  ├─ src/
│  │  ├─ components/     # Layout, ui, Icon, ProtectedRoute
│  │  ├─ context/        # AuthContext
│  │  ├─ pages/          # une page par écran
│  │  ├─ services/       # client API + couche de service (réel/démo)
│  │  ├─ lib/format.js
│  │  ├─ App.jsx         # routes
│  │  └─ main.jsx        # point d'entrée
│  ├─ .env.example
│  ├─ vite.config.js     # proxy /api -> http://127.0.0.1:8000
│  └─ package.json
└─ README.md
```

---

## Prérequis

- **Python 3.11+**
- **Node.js 18+** et npm
- Accès à une base **PostgreSQL** (ex. projet Supabase) — ou SQLite en dev

---

## Démarrage rapide

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows PowerShell
pip install -r requirements.txt

Copy-Item .env.example .env           # puis renseignez DATABASE_URL
python manage.py migrate
python manage.py createsuperuser      # crée un administrateur
python manage.py runserver            # http://127.0.0.1:8000
```

> Pas de base PostgreSQL sous la main ? Voir
> [Développement avec SQLite](#développement-avec-sqlite).

### 2. Frontend

```powershell
cd frontend
npm install

Copy-Item .env.example .env           # VITE_API_BASE_URL vide suffit en dev
npm run dev                           # http://localhost:5173
```

En développement, Vite redirige automatiquement les appels `/api` vers Django
(`http://127.0.0.1:8000`). Ouvrez **http://localhost:5173**.

---

## Configuration

### Backend — `backend/.env`

| Variable | Description | Défaut |
| --- | --- | --- |
| `SECRET_KEY` | Clé secrète Django. **Obligatoire en production.** | Clé aléatoire éphémère en dev |
| `DEBUG` | Mode débogage | `true` |
| `ALLOWED_HOSTS` | Hôtes autorisés (séparés par des virgules) | `localhost,127.0.0.1` |
| `DATABASE_URL` | URL PostgreSQL (Supabase) | vide |
| `DEV_USE_SQLITE` | `true` = utilise SQLite (dev/tests hors ligne) | `false` |
| `DB_CONN_MAX_AGE` | Durée de conservation des connexions (s) | `600` |
| `DB_SSL_REQUIRE` | Impose SSL (Supabase) | `true` |
| `DB_CONNECT_TIMEOUT` | Délai de connexion (s) | `10` |
| `DB_DISABLE_PREPARED_STATEMENTS` | `true` pour le pooler Supabase (port 6543) | `false` |
| `CORS_ALLOWED_ORIGINS` | Origines autorisées du frontend | `http://localhost:5173,http://127.0.0.1:5173` |
| `CSRF_TRUSTED_ORIGINS` | Origines de confiance CSRF | `http://localhost:5173,http://127.0.0.1:5173` en DEBUG, vide sinon |

**Connexion Supabase** (`DATABASE_URL`) :

```dotenv
# Connexion directe (IPv6) :
DATABASE_URL=postgresql://postgres.<ref>:<motdepasse>@db.<ref>.supabase.co:5432/postgres

# Via le pooler en mode transaction (recommandé sur Render / connexions éphémères) :
DATABASE_URL=postgresql://postgres.<ref>:<motdepasse>@aws-0-<region>.pooler.supabase.com:6543/postgres
DB_DISABLE_PREPARED_STATEMENTS=true
```

### Frontend — `frontend/.env`

| Variable | Description | Défaut |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Origine de l'API **sans** `/api` (vide en dev grâce au proxy) | vide |
| `VITE_DEMO_MODE` | `true` = mode démonstration (données locales, aucun réseau) | `false` |

> ⚠️ Ne committez jamais `backend/.env` ni `frontend/.env` (exclus par
> `.gitignore`). Ne committez que les fichiers `.env.example`.

---

## Base de données

Le schéma est versionné dans `backend/core/migrations/0001_initial.py`.

```powershell
python manage.py migrate        # applique les migrations
python manage.py makemigrations # après modification des modèles
```

### Refus de démarrage volontaire

Sans `DATABASE_URL` **et** sans `DEV_USE_SQLITE=true`, Django **refuse de
démarrer** avec une erreur explicite. Aucune bascule silencieuse vers SQLite :
vous savez toujours sur quelle base vous travaillez.

### Développement avec SQLite

Pour travailler hors ligne (ou lancer les tests) sans PostgreSQL :

```powershell
$env:DEV_USE_SQLITE='true'
python manage.py migrate
python manage.py runserver
```

---

## Comptes et rôles

- **Administrateur (`ADMIN`)** : accès complet — utilisateurs, journal,
  paramètres, rapports, catalogue, ventes.
- **Vendeur (`VENDOR`)** : caisse, ventes, produits (consultation/ajustement),
  clients, fournisseurs.

Créez le premier administrateur :

```powershell
python manage.py createsuperuser
```

> Ne fixez jamais un mot de passe en dur. Les mots de passe sont hachés par
> Django et les validations de robustesse sont actives.

### Inscription publique

La page `/inscription` du frontend permet à un visiteur de créer son propre
compte via `POST /api/auth/register/`. Règles appliquées côté serveur :

- Le **rôle est forcé à `VENDOR`** : un visiteur ne peut jamais obtenir `ADMIN`
  (tout champ `role` envoyé est ignoré).
- L'identifiant de connexion est l'**adresse e-mail** (normalisée en minuscules).
- Les mots de passe sont hachés par Django (`set_password`) et soumis aux
  validateurs (`validate_password`).
- Les e-mails/identifiants déjà utilisés sont rejetés avec un message clair.
- La session est ouverte automatiquement après l'inscription.

> ⚠️ L'inscription est **ouverte à toute personne** connaissant l'URL : un nouvel
> inscrit devient immédiatement un vendeur actif. Pour restreindre l'accès,
> désactivez cette route côté backend ou passez `is_active=False` puis faites
> activer les comptes par un administrateur.

---

## Mode réel vs mode démonstration

Le frontend ne contient **aucune donnée métier en dur** : toutes les pages
passent par `frontend/src/services/index.js`, qui bascule entre deux modes
selon `VITE_DEMO_MODE` :

| `VITE_DEMO_MODE` | Comportement |
| --- | --- |
| *(absent ou ≠ `true`)* | **Mode réel** : appels à l'API Django / Supabase |
| `true` | Mode démonstration : données fictives locales en mémoire |

Pour utiliser les données réelles (Supabase), laissez `VITE_DEMO_MODE` vide ou
à `false` dans `frontend/.env`, démarrez le backend Django, puis `npm run dev`.

---

## Mode démonstration

Le frontend peut tourner **sans backend** avec des données fictives locales :

```powershell
cd frontend
Copy-Item .env.example .env
Add-Content .env "VITE_DEMO_MODE=true"
npm run dev
```

- Identifiants démo : n'importe lequel de `admin` ou `vendeur`, mot de passe
  **`demo`**.
- Aucune donnée n'est envoyée à Supabase ; les modifications restent en mémoire
  dans l'onglet. Un bandeau signale le mode démo.

### Données de démonstration côté backend (dev uniquement)

```powershell
$env:DEV_USE_SQLITE='true'   # ou votre DATABASE_URL de dev
python manage.py seed_demo
```

Crée catégories, produits, clients, fournisseurs et deux comptes
(`demo_admin` / `demo-admin-2026`, `demo_vendeur` / `demo-vendeur-2026`).
La commande **refuse de s'exécuter si `DEBUG=False`** pour ne jamais polluer la
production.

---

## Tests

```powershell
cd backend
$env:DEV_USE_SQLITE='true'
python manage.py test
```

La suite couvre : santé, authentification (dont inscription et login par
e-mail), permissions/rôles (dont la matrice des droits d'accès et l'origine
CSRF du frontend), catalogue, ventes (recalcul serveur, stock insuffisant,
idempotence, remise, annulation, audit), approvisionnements, clients, tableau
de bord, rapports (dont l'anti-injection CSV) et journal d'activité.

Vérification de configuration :

```powershell
python manage.py check
```

Frontend (lint) :

```powershell
cd frontend
npm run lint
```

---

## Build et déploiement

### Frontend

```powershell
cd frontend
npm run build     # génère frontend/dist/
npm run preview   # prévisualisation locale du build
```

En production, définissez `VITE_API_BASE_URL` vers l'URL publique du backend
(par exemple `https://api.mondomaine.com`), puis servez `frontend/dist/` via un
hébergeur statique en veillant à **rediriger toutes les routes vers
`index.html`** (application SPA).

### Backend

```powershell
python manage.py collectstatic --noinput
# Lancer avec un serveur WSGI/ASGI de production (gunicorn/uvicorn, etc.)
```

Points d'attention en production :

- `DEBUG=false`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` et `CORS_ALLOWED_ORIGINS`
  correctement renseignés.
- `SECRET_KEY` unique et secrète.
- Basculer `DEV_USE_SQLITE` sur `false` et fournir `DATABASE_URL`.

---

## Référence de l'API

Base : `/api/`

### Authentification (session + CSRF)

| Méthode | Chemin | Description |
| --- | --- | --- |
| `GET` | `/api/auth/csrf/` | Récupère le cookie CSRF |
| `POST` | `/api/auth/register/` | Inscription publique (crée un compte **Vendeur**) |
| `POST` | `/api/auth/login/` | Connexion (identifiant **ou** e-mail, insensible à la casse) |
| `POST` | `/api/auth/logout/` | Déconnexion |
| `GET` | `/api/auth/me/` | Utilisateur courant |
| `GET` | `/api/health/` | État du service |

### Ressources (ViewSets DRF)

`categories`, `products`, `stock-movements`, `customers`, `suppliers`,
`purchases`, `sales`, `users`, `audit-logs`

Actions personnalisées notables :

- `POST /api/products/{id}/adjust-stock/` — ajustement manuel du stock
- `POST /api/products/{id}/archive/` — archivage
- `POST /api/sales/` — encaissement (idempotent via `idempotency_key`)
- `POST /api/sales/{id}/cancel/` — annulation (restaure le stock)
- `GET /api/sales/{id}/receipt/` — données du reçu

### Vues custom

| Méthode | Chemin | Description |
| --- | --- | --- |
| `GET` | `/api/dashboard/` | Indicateurs du tableau de bord |
| `GET` | `/api/reports/` | Rapports agrégés |
| `GET` | `/api/reports/sales/export/` | Export CSV des ventes |
| `GET`/`PATCH` | `/api/settings/shop/` | Paramètres de la boutique |
| `GET` | `/api/access-rights/` | Matrice des droits par rôle (admin, lecture seule) |

---

## Bonnes pratiques et sécurité

- **Secrets** : jamais de mot de passe, clé ou URL de connexion en dur dans le
  code. Tout passe par `.env` (non versionné).
- **Authentification** : sessions Django + protection CSRF ; CORS restreint aux
  origines du frontend.
- **Montants** : `DecimalField` sans décimales (FCFA, entiers).
- **Stock** : décrémenté côté serveur dans une transaction atomique.
- **Export CSV** : neutralisation des cellules pour éviter l'injection de
  formules dans les tableurs.
- **Journal d'activité** : n'enregistre ni mot de passe ni secret.

---

## Licence

Projet interne — voir l'équipe propriétaire pour toute redistribution.
