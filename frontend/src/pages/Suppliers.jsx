import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, Modal, Pagination, Spinner } from '../components/ui'
import { createSupplier, listSuppliers, updateSupplier } from '../services'

const EMPTY = { name: '', phone: '', email: '', address: '', notes: '' }

export default function Suppliers() {
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listSuppliers({ search, page }))
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
      if (modal?.id) await updateSupplier(modal.id, form)
      else await createSupplier(form)
      setModal(null)
      load()
    } catch (err) {
      setFormError(err.fields?.name?.[0] ?? err.message)
    }
  }

  const pageCount = Math.max(1, Math.ceil(data.count / 20))

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Fournisseurs</h1>
          <p>Sources d&apos;approvisionnement de la boutique.</p>
        </div>
        <button type="button" className="btn" onClick={() => { setForm(EMPTY); setModal({}) }}>
          Ajouter un fournisseur
        </button>
      </div>

      <div className="filters card" style={{ padding: 14 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Recherche</label>
          <input placeholder="Nom ou téléphone…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}
      {!loading && !error && data.results.length === 0 && (
        <EmptyState title="Aucun fournisseur" />
      )}

      {!loading && !error && data.results.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Nom</th><th>Téléphone</th><th>E-mail</th><th>Adresse</th><th>Actions</th></tr></thead>
            <tbody>
              {data.results.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.phone || '—'}</td>
                  <td>{s.email || '—'}</td>
                  <td>{s.address || '—'}</td>
                  <td>
                    <button
                      type="button" className="btn btn--secondary btn--sm"
                      onClick={() => { setForm({ name: s.name, phone: s.phone, email: s.email, address: s.address, notes: s.notes }); setModal(s) }}
                    >
                      Modifier
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
        <Modal title={modal.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <div className="field"><label>Nom *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
            <div className="field"><label>Téléphone</label><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div className="field"><label>E-mail</label><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div className="field"><label>Adresse</label><input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
            <div className="field"><label>Notes</label><textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            {formError && <p role="alert" style={{ color: 'var(--danger)', marginBottom: 12 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setModal(null)}>Annuler</button>
              <button type="submit" className="btn">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
