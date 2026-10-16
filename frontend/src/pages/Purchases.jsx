import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, Modal, Pagination, Spinner } from '../components/ui'
import { formatFCFA, todayISO } from '../lib/format'
import { createPurchase, listProducts, listPurchases, listSuppliers } from '../services'

export default function Purchases() {
  const [data, setData] = useState({ count: 0, results: [] })
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ supplier: '', date: todayISO(), notes: '', items: [{ product_id: '', quantity: '1', unit_cost: '' }] })
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [purchases, prods, sups] = await Promise.all([
        listPurchases({ page }),
        listProducts({ page_size: 100 }),
        listSuppliers(),
      ])
      setData(purchases)
      setProducts(prods.results)
      setSuppliers(sups.results)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  function setItem(index, key, value) {
    setForm((f) => ({
      ...f,
      items: f.items.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      await createPurchase({
        supplier: form.supplier ? Number(form.supplier) : null,
        date: form.date,
        notes: form.notes,
        items: form.items
          .filter((l) => l.product_id && Number(l.quantity) > 0)
          .map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity), unit_cost: l.unit_cost || '0' })),
      })
      setModal(false)
      setForm({ supplier: '', date: todayISO(), notes: '', items: [{ product_id: '', quantity: '1', unit_cost: '' }] })
      load()
    } catch (err) {
      setFormError(err.fields?.items?.[0] ?? err.message)
    } finally {
      setSaving(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(data.count / 20))

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Approvisionnements</h1>
          <p>Réceptions de marchandise : le stock et le coût d&apos;achat sont mis à jour automatiquement.</p>
        </div>
        <button type="button" className="btn" onClick={() => setModal(true)}>Nouvelle réception</button>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}
      {!loading && !error && data.results.length === 0 && (
        <EmptyState title="Aucun approvisionnement" message="Enregistrez les lots reçus de vos fournisseurs." />
      )}

      {!loading && !error && data.results.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Référence</th><th>Date</th><th>Fournisseur</th><th className="right">Articles</th><th className="right">Coût total</th><th>Par</th></tr>
            </thead>
            <tbody>
              {data.results.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'var(--mono)' }}>{p.reference}</td>
                  <td className="num">{p.date}</td>
                  <td>{p.supplier_name ?? 'Autre source'}</td>
                  <td className="right num">{p.items.reduce((s, l) => s + l.quantity, 0)}</td>
                  <td className="right num">{formatFCFA(p.total_cost)}</td>
                  <td>{p.created_by_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} count={data.count} onPage={setPage} />

      {modal && (
        <Modal title="Nouvelle réception" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Fournisseur (facultatif)</label>
                <select value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}>
                  <option value="">Autre source</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            <h3 style={{ margin: '10px 0' }}>Articles reçus</h3>
            {form.items.map((line, i) => (
              <div key={i} className="filters" style={{ marginBottom: 10, alignItems: 'end' }}>
                <div className="field" style={{ flex: 2 }}>
                  <label>Produit</label>
                  <select value={line.product_id} onChange={(e) => setItem(i, 'product_id', e.target.value)} required>
                    <option value="">— Choisir —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Quantité</label>
                  <input type="number" min="1" value={line.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} required />
                </div>
                <div className="field">
                  <label>Coût unitaire</label>
                  <input type="number" min="0" value={line.unit_cost} onChange={(e) => setItem(i, 'unit_cost', e.target.value)} />
                </div>
                <button
                  type="button" className="btn btn--ghost btn--sm"
                  onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))}
                  disabled={form.items.length === 1}
                >
                  Retirer
                </button>
              </div>
            ))}
            <button
              type="button" className="btn btn--secondary btn--sm"
              onClick={() => setForm((f) => ({ ...f, items: [...f.items, { product_id: '', quantity: '1', unit_cost: '' }] }))}
            >
              + Ajouter une ligne
            </button>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Notes</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>

            {formError && <p role="alert" style={{ color: 'var(--danger)', marginBottom: 12 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setModal(false)}>Annuler</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer la réception'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
