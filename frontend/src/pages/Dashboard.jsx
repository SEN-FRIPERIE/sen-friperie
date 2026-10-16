import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { formatDateTime, formatFCFA } from '../lib/format'
import { fetchDashboard } from '../services'

const PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
]

function Kpi({ label, value, hint }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchDashboard({ period }))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>Indicateurs calculés sur les ventes réelles · {data?.period?.label ?? ''}</p>
        </div>
        <div className="filters" role="group" aria-label="Période">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`btn btn--sm ${period === p.key ? '' : 'btn--secondary'}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          <div className="kpi-grid">
            <Kpi label="Chiffre d'affaires" value={formatFCFA(data.revenue)} />
            <Kpi label="Ventes" value={data.sales_count} />
            <Kpi label="Bénéfice brut estimé" value={formatFCFA(data.gross_profit)} hint={`CMV : ${formatFCFA(data.cost_of_goods_sold)}`} />
            <Kpi label="Produits en stock" value={data.products_in_stock} />
            <Kpi label="Stock bas" value={data.low_stock_count} hint={`${data.out_of_stock_count} en rupture`} />
            <Kpi label="Valeur du stock (achat)" value={formatFCFA(data.stock_value_at_cost)} />
          </div>

          <div className="two-col">
            <section className="card">
              <h2 style={{ marginBottom: 14 }}>Dernières ventes</h2>
              {data.recent_sales.length === 0 ? (
                <EmptyState title="Aucune vente" message="Les ventes apparaîtront ici." />
              ) : (
                <div className="table-wrap" style={{ border: 'none' }}>
                  <table className="data">
                    <thead>
                      <tr><th>Numéro</th><th>Client</th><th>Paiement</th><th className="right">Total</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                      {data.recent_sales.map((sale) => (
                        <tr key={sale.id}>
                          <td><Link to={`/ventes/${sale.id}`}>{sale.number}</Link></td>
                          <td>{sale.customer ?? 'Client comptoir'}</td>
                          <td>{sale.payment_method}</td>
                          <td className="right num">{formatFCFA(sale.total_amount)}</td>
                          <td className="num">{formatDateTime(sale.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <section className="card">
                <h2 style={{ marginBottom: 14 }}>Produits les plus vendus</h2>
                {data.top_products.length === 0 ? (
                  <EmptyState title="Aucune vente sur la période" />
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                    {data.top_products.map((p) => (
                      <li key={p.product_id} style={{ marginBottom: 6 }}>
                        {p.name} — <strong>{p.quantity_sold}</strong> vendu(s), {formatFCFA(p.revenue)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <h2 style={{ marginBottom: 14 }}>Alertes de stock</h2>
                {data.low_stock_alerts.length === 0 ? (
                  <EmptyState title="Aucune alerte" message="Tous les stocks sont au-dessus du seuil." />
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                    {data.low_stock_alerts.map((p) => (
                      <li key={p.id} style={{ marginBottom: 6 }}>
                        <Link to="/produits">{p.name}</Link> ({p.sku}) — {p.quantity} restant(s)
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </>
  )
}
