import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, Pagination, Spinner } from '../components/ui'
import { formatDateTime } from '../lib/format'
import { listAuditLogs } from '../services'

export default function AuditLog() {
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listAuditLogs({ page }))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const pageCount = Math.max(1, Math.ceil(data.count / 20))

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Journal d&apos;activité</h1>
          <p>Trace des événements importants. Aucun mot de passe ni secret n&apos;y est enregistré.</p>
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}
      {!loading && !error && data.results.length === 0 && <EmptyState title="Journal vide" />}

      {!loading && !error && data.results.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Objet</th><th>Résumé</th></tr>
            </thead>
            <tbody>
              {data.results.map((log) => (
                <tr key={log.id}>
                  <td className="num">{formatDateTime(log.created_at)}</td>
                  <td>{log.user_display ?? 'Système'}</td>
                  <td>{log.action_display}</td>
                  <td>{log.object_type}{log.object_id ? ` #${log.object_id}` : ''}</td>
                  <td>{log.summary}</td>
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
