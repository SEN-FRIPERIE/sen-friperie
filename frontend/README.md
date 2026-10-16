# SEN-Friperie - Frontend

Application React (Vite) de SEN-Friperie.

## Commandes

```powershell
npm install        # installer les dependances
npm run dev        # serveur de developpement (http://localhost:5173)
npm run build      # build de production (dossier dist/)
npm run lint       # analyse statique (oxlint)
npm run preview    # previsualiser le build
```

## Configuration

Copier `.env.example` vers `.env`. La variable `VITE_API_BASE_URL` contient
l'origine de l'API (sans `/api`). En developpement, laisser vide : le proxy
Vite redirige `/api` vers le backend Django (voir `vite.config.js`).

## Structure

```
src/
  components/    composants reutilisables
  pages/         pages de l'application
  hooks/         hooks React (ex. useApiHealth)
  services/      acces a l'API (apiClient, health)
```

Voir le README a la racine du projet pour les instructions completes.
