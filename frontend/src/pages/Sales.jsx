import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, Pagination, Spinner, Badge } from '../components/ui'
import { daysAgoISO, formatDateTime, formatFCFA, todayISO } from '../lib/format'
import { listSales } from '../services'

const PAYMENTS = [
  ['', 'Tous les paiements'], ['CASH', 'Espèces'], ['WAVE', 'Wave'],
  ['ORANGE_MONEY', 'Orange Money'], ['MOOV_MONEY', 'Moov Money'],
  ['CARD', 'Carte'], ['OTHER', 'Autre'],
]

const STATUSES = [
  ['', 'Tous les statuts'], ['COMPLETED', 'Validées'], ['CANCELLED', 'Annulées'],
]

export default function Sales() {
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    date_from: daysAgoISO(30), date_to: todayISO(), payment_method: '', status: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listSales({ ...filters, page }))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { load() }, [load])

  function setFilter(key) {
    return (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1) }
  }

  const pageCount = Math.max(1, Math.ceil(data.count / 20))

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Ventes</h1>
          <p>{data.count} vente(s) sur la période. Les ventes ne sont jamais supprimées, seulement annulées.</p>
        </div>
        <Link to="/caisse" className="btn">Nouvelle vente</Link>
      </div>

      <div className="filters card" style={{ padding: 14 }}>
        <div className="field">
          <label>Du</label>
          <input type="date" value={filters.date_from} onChange={setFilter('date_from')} />
        </div>
        <div className="field">
          <label>Au</label>
          <input type="date" value={filters.date_to} onChange={setFilter('date_to')} />
        </div>
        <div className="field">
          <label>Paiement</label>
          <select value={filters.payment_method} onChange={setFilter('payment_method')}>
            {PAYMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Statut</label>
          <select value={filters.status} onChange={setFilter('status')}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}
      {!loading && !error && data.results.length === 0 && (
        <EmptyState title="Aucune vente" message="Encaissez une vente depuis la caisse." />
      )}

      {!loading && !error && data.results.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Numéro</th><th>Date</th><th>Client</th><th>Vendeur</th>
                <th>Paiement</th><th className="right">Total</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/ventes/${s.id}`}><strong>{s.number}</strong></Link></td>
                  <td className="num">{formatDateTime(s.created_at)}</td>
                  <td>{s.customer_name ?? 'Comptoir'}</td>
                  <td>{s.seller_name}</td>
                  <td>{s.payment_method_display}</td>
                  <td className="right num">{formatFCFA(s.total_amount)}</td>
                  <td>
                    <Badge tone={s.status === 'COMPLETED' ? 'success' : 'danger'}>{s.status_display}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} count={data.count} onPage={setPage} />
    </>
  )
}
