import StatusBadge from '../components/StatusBadge'
import { API_STATUS, useApiHealth } from '../hooks/useApiHealth'

const FEATURES = [
  'Authentification et gestion des roles',
  'Tableau de bord',
  'Produits et stock',
  'Ventes et caisse',
  'Fournisseurs, achats et approvisionnements',
  'Factures, recus et clients',
  'Journal d\u2019audit et historique',
  'Rapports, statistiques et sauvegardes',
]

function Home() {
  const { status, data, error, refresh } = useApiHealth()

  return (
    <div className="home">
      <header className="home__header">
        <p className="home__eyebrow">Gestion de boutique</p>
        <h1 className="home__title">SEN-Friperie</h1>
        <p className="home__subtitle">
          Application de gestion d&apos;une boutique de vetements de seconde main.
        </p>
      </header>

      <section className="status-card" aria-live="polite">
        <div className="status-card__row">
          <span className="status-card__label">Etat du backend</span>
          <StatusBadge status={status} />
        </div>

        {status === API_STATUS.ONLINE && data && (
          <dl className="status-card__details">
            <div>
              <dt>Service</dt>
              <dd>{data.service}</dd>
            </div>
            <div>
              <dt>Base de donnees</dt>
              <dd>{data.database}</dd>
            </div>
            <div>
              <dt>Heure serveur</dt>
              <dd>{data.time}</dd>
            </div>
          </dl>
        )}

        {status === API_STATUS.OFFLINE && (
          <p className="status-card__error">
            {error?.message ?? 'API indisponible.'}
          </p>
        )}

        <button
          type="button"
          className="status-card__refresh"
          onClick={refresh}
          disabled={status === API_STATUS.LOADING}
        >
          {status === API_STATUS.LOADING ? 'Verification...' : 'Verifier a nouveau'}
        </button>
      </section>

      <section className="home__features">
        <h2>Modules prevus</h2>
        <ul>
          {FEATURES.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <footer className="home__footer">
        Etape 2 &mdash; socle technique. Aucune donnee metier ni base distante connectee.
      </footer>
    </div>
  )
}

export default Home
