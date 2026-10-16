import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, Modal, Spinner } from '../components/ui'
import { archiveCategory, createCategory, listCategories, updateCategory } from '../services'

export default function Categories() {
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', is_active: true })
  const [formError, setFormError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listCategories({ include_archived: 'true' }))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    try {
      if (modal?.id) await updateCategory(modal.id, form)
      else await createCategory(form)
      setModal(null)
      load()
    } catch (err) {
      setFormError(err.fields?.name?.[0] ?? err.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Catégories</h1>
          <p>Organisez le catalogue de la boutique.</p>
        </div>
        <button type="button" className="btn" onClick={() => { setForm({ name: '', description: '', is_active: true }); setModal({}) }}>
          Ajouter une catégorie
        </button>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}
      {!loading && !error && data.results.length === 0 && (
        <EmptyState title="Aucune catégorie" message="Créez des catégories pour structurer vos produits." />
      )}

      {!loading && !error && data.results.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Nom</th><th>Description</th><th className="right">Produits</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.results.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.description || '—'}</td>
                  <td className="right num">{c.product_count}</td>
                  <td>
                    <span className={`badge badge--${c.is_active ? 'success' : 'neutral'}`}>
                      {c.is_active ? 'Active' : 'Archivée'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setForm({ name: c.name, description: c.description, is_active: c.is_active }); setModal(c) }}>
                      Modifier
                    </button>{' '}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={async () => { await archiveCategory(c.id); load() }}>
                      {c.is_active ? 'Archiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Nom</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="field">
              <label>Description (facultative)</label>
              <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
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
