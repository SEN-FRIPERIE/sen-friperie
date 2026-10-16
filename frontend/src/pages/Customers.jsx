import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, Modal, Pagination, Spinner } from '../components/ui'
import { formatDateTime, formatFCFA } from '../lib/format'
import { createCustomer, customerSales, listCustomers, updateCustomer } from '../services'

const EMPTY = { first_name: '', last_name: '', phone: '', email: '', address: '', notes: '' }

export default function Customers() {
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState(null)
  const [history, setHistory] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listCustomers({ search, page }))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    try {
      if (modal?.id) await updateCustomer(modal.id, form)
      else await createCustomer(form)
      setModal(null)
      load()
    } catch (err) {
      setFormError(err.fields?.last_name?.[0] ?? err.message)
    }
  }

  async function openHistory(customer) {
    try {
      const res = await customerSales(customer.id)
      setHistory({ customer, sales: res.results })
    } catch (err) {
      setHistory({ customer, sales: [], error: err.message })
    }
  }

  const pageCount = Math.max(1, Math.ceil(data.count / 20))

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Clients</h1>
          <p>Fiches clients et historique d&apos;achats.</p>
        </div>
        <button type="button" className="btn" onClick={() => { setForm(EMPTY); setModal({}) }}>
          Ajouter un client
        </button>
      </div>

      <div className="filters card" style={{ padding: 14 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Recherche</label>
          <input placeholder="Nom, téléphone, e-mail…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}
      {!loading && !error && data.results.length === 0 && (
        <EmptyState title="Aucun client" message="Les clients sont facultatifs à la caisse mais permettent de suivre les habitués." />
      )}

      {!loading && !error && data.results.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Nom</th><th>Téléphone</th><th>E-mail</th>
                <th className="right">Achats</th><th className="right">Total</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.display_name}</strong></td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td className="right num">{c.purchase_count}</td>
                  <td className="right num">{formatFCFA(c.total_purchases)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setForm({ first_name: c.first_name, last_name: c.last_name, phone: c.phone, email: c.email, address: c.address, notes: c.notes }); setModal(c) }}>
                      Modifier
                    </button>{' '}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => openHistory(c)}>
                      Historique
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} count={data.count} onPage={setPage} />

      {modal && (
        <Modal title={modal.id ? 'Modifier le client' : 'Nouveau client'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field"><label>Prénom</label><input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /></div>
              <div className="field"><label>Nom *</label><input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} required /></div>
              <div className="field"><label>Téléphone</label><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              <div className="field"><label>E-mail</label><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div className="field"><label>Adresse</label><input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
            </div>
            <div className="field"><label>Notes</label><textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            {formError && <p role="alert" style={{ color: 'var(--danger)', marginBottom: 12 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setModal(null)}>Annuler</button>
              <button type="submit" className="btn">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}

      {history && (
        <Modal title={`Historique — ${history.customer.display_name}`} onClose={() => setHistory(null)}>
          {history.error && <p style={{ color: 'var(--danger)' }}>{history.error}</p>}
          {!history.error && history.sales.length === 0 && <EmptyState title="Aucun achat" />}
          {history.sales.length > 0 && (
            <table className="data">
              <thead><tr><th>Vente</th><th>Date</th><th className="right">Total</th></tr></thead>
              <tbody>
                {history.sales.map((s) => (
                  <tr key={s.id}>
                    <td>{s.number}</td>
                    <td>{formatDateTime(s.created_at)}</td>
                    <td className="right num">{formatFCFA(s.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </>
  )
}
