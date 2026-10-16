import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { daysAgoISO, formatFCFA, todayISO } from '../lib/format'
import { fetchReports, isDemoMode, reportsCsvUrl } from '../services'

const GROUPS = [
  { key: 'day', label: 'Par jour' },
  { key: 'week', label: 'Par semaine' },
  { key: 'month', label: 'Par mois' },
]

export default function Reports() {
  const [period, setPeriod] = useState({ date_from: daysAgoISO(30), date_to: todayISO() })
  const [group, setGroup] = useState('day')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchReports({ period: 'custom', ...period, group }))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [period, group])

  useEffect(() => { load() }, [load])

  const csvHref = `${reportsCsvUrl({ period: 'custom', ...period })}`

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Rapports</h1>
          <p>
            Bénéfice brut estimé = chiffre d&apos;affaires − coût des marchandises vendues
            (hors loyer, salaires, taxes).
          </p>
        </div>
        <a className="btn btn--secondary" href={csvHref} download={!isDemoMode()}>
          Exporter les ventes (CSV)
        </a>
      </div>

      <div className="filters card" style={{ padding: 14 }}>
        <div className="field">
          <label>Du</label>
          <input type="date" value={period.date_from} onChange={(e) => setPeriod((p) => ({ ...p, date_from: e.target.value }))} />
        </div>
        <div className="field">
          <label>Au</label>
          <input type="date" value={period.date_to} onChange={(e) => setPeriod((p) => ({ ...p, date_to: e.target.value }))} />
        </div>
        <div className="field">
          <label>Agrégation</label>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          <div className="kpi-grid">
            <div className="kpi"><span>Chiffre d'affaires</span><strong>{formatFCFA(data.totals.revenue)}</strong></div>
            <div className="kpi"><span>Coût des marchandises vendues</span><strong>{formatFCFA(data.totals.cost_of_goods_sold)}</strong></div>
            <div className="kpi"><span>Bénéfice brut estimé</span><strong>{formatFCFA(data.totals.gross_profit)}</strong></div>
            <div className="kpi"><span>Ventes</span><strong>{data.totals.sales_count}</strong></div>
            <div className="kpi"><span>Valeur du stock (achat)</span><strong>{formatFCFA(data.stock_value_at_cost)}</strong></div>
          </div>

          <div className="two-col">
            <section className="card">
              <h2 style={{ marginBottom: 14 }}>Ventes {group === 'day' ? 'par jour' : group === 'week' ? 'par semaine' : 'par mois'}</h2>
              {data.sales_by_period.length === 0 ? (
                <EmptyState title="Aucune vente sur la période" />
              ) : (
                <div className="table-wrap" style={{ border: 'none' }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Période</th><th className="right">Ventes</th><th className="right">Articles</th>
                        <th className="right">CA</th><th className="right">CMV</th><th className="right">Bénéfice brut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sales_by_period.map((row) => (
                        <tr key={row.period}>
                          <td className="num">{row.period}</td>
                          <td className="right num">{row.sales_count}</td>
                          <td className="right num">{row.items_sold}</td>
                          <td className="right num">{formatFCFA(row.revenue)}</td>
                          <td className="right num">{formatFCFA(row.cogs)}</td>
                          <td className="right num">{formatFCFA(row.gross_profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <section className="card">
                <h2 style={{ marginBottom: 14 }}>Modes de paiement</h2>
                {data.payment_breakdown.length === 0 ? (
                  <EmptyState title="Aucune donnée" />
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                    {data.payment_breakdown.map((p) => (
                      <li key={p.payment_method} style={{ marginBottom: 6 }}>
                        {p.label} — <strong>{formatFCFA(p.revenue)}</strong> ({p.count} vente(s))
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <h2 style={{ marginBottom: 14 }}>Produits les plus vendus</h2>
                {data.top_products.length === 0 ? (
                  <EmptyState title="Aucune donnée" />
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                    {data.top_products.map((p) => (
                      <li key={p.product_id} style={{ marginBottom: 6 }}>
                        {p.name} ({p.sku}) — <strong>{p.quantity_sold}</strong> vendu(s)
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
