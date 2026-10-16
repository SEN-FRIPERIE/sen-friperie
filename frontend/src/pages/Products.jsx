import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, Modal, Pagination, Spinner, Badge } from '../components/ui'
import { formatFCFA } from '../lib/format'
import {
  adjustStock, archiveProduct, createProduct, listCategories, listProducts, updateProduct,
} from '../services'

const CONDITIONS = [
  ['', 'Tous les états'], ['NEW', 'Neuf'], ['VERY_GOOD', 'Très bon état'],
  ['GOOD', 'Bon état'], ['FAIR', 'État satisfaisant'],
]
const SIZES = [
  ['', 'Toutes'], ['XS', 'XS'], ['S', 'S'], ['M', 'M'], ['L', 'L'],
  ['XL', 'XL'], ['XXL', 'XXL'], ['UNIQUE', 'Taille unique'],
]
const AVAILABILITY = [
  ['', 'Toute disponibilité'], ['in_stock', 'En stock'], ['low', 'Stock bas'], ['out', 'En rupture'],
]

const EMPTY_FORM = {
  sku: '', name: '', description: '', category: '', size: 'UNIQUE', color: '',
  condition: 'GOOD', purchase_price: '', sale_price: '', quantity: '0',
  low_stock_threshold: '1', image_url: '',
}

function ProductForm({ initial, categories, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrors({})
    setServerError(null)
    const local = {}
    if (!form.sku.trim()) local.sku = 'Référence obligatoire.'
    if (!form.name.trim()) local.name = 'Nom obligatoire.'
    if (form.sale_price === '' || Number(form.sale_price) < 0) local.sale_price = 'Prix de vente invalide.'
    if (Object.keys(local).length) { setErrors(local); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        sku: form.sku.trim().toUpperCase(),
        category: form.category || null,
        purchase_price: form.purchase_price || '0',
        sale_price: form.sale_price,
        quantity: form.quantity || '0',
        low_stock_threshold: form.low_stock_threshold || '1',
      }
      await onSubmit(payload)
    } catch (err) {
      if (err.fields) {
        const mapped = {}
        Object.entries(err.fields).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : String(v) })
        setErrors(mapped)
      } else {
        setServerError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {serverError && <p role="alert" style={{ color: 'var(--danger)', marginBottom: 12 }}>{serverError}</p>}
      <div className="form-grid">
        <div className="field">
          <label>Référence (SKU)</label>
          <input value={form.sku} onChange={set('sku')} placeholder="ex. JEAN-001" />
          {errors.sku && <span className="error">{errors.sku}</span>}
        </div>
        <div className="field">
          <label>Nom</label>
          <input value={form.name} onChange={set('name')} />
          {errors.name && <span className="error">{errors.name}</span>}
        </div>
        <div className="field">
          <label>Catégorie</label>
          <select value={form.category ?? ''} onChange={set('category')}>
            <option value="">— Aucune —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Taille</label>
          <select value={form.size} onChange={set('size')}>
            {SIZES.filter(Boolean).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Couleur</label>
          <input value={form.color} onChange={set('color')} />
        </div>
        <div className="field">
          <label>État</label>
          <select value={form.condition} onChange={set('condition')}>
            {CONDITIONS.filter(Boolean).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Prix d'achat (FCFA)</label>
          <input type="number" min="0" value={form.purchase_price} onChange={set('purchase_price')} />
        </div>
        <div className="field">
          <label>Prix de vente (FCFA)</label>
          <input type="number" min="0" value={form.sale_price} onChange={set('sale_price')} />
          {errors.sale_price && <span className="error">{errors.sale_price}</span>}
        </div>
        <div className="field">
          <label>Quantité</label>
          <input type="number" min="0" value={form.quantity} onChange={set('quantity')} disabled={!!initial} />
          {initial && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Utilisez l'ajustement de stock.</span>}
        </div>
        <div className="field">
          <label>Seuil d'alerte</label>
          <input type="number" min="0" value={form.low_stock_threshold} onChange={set('low_stock_threshold')} />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>URL de l'image (facultative)</label>
          <input value={form.image_url} onChange={set('image_url')} placeholder="https://…" />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={set('description')} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

function StockAdjust({ product, onCancel, onSaved }) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await adjustStock(product.id, Number(quantity), reason)
      onSaved()
    } catch (err) {
      setError(err.fields?.quantity?.[0] ?? err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ marginBottom: 12, fontSize: 14 }}>
        Produit : <strong>{product.name}</strong> ({product.sku}) — stock actuel : {product.quantity}
      </p>
      <div className="field">
        <label>Quantité (ex. 5 ou -2)</label>
        <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
      </div>
      <div className="field">
        <label>Motif</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex. Retour client, casse…" />
      </div>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn" disabled={saving}>Valider</button>
      </div>
    </form>
  )
}

export default function Products() {
  const [data, setData] = useState({ count: 0, results: [] })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ search: '', category: '', size: '', condition: '', availability: '' })
  const [modal, setModal] = useState(null) // { type: 'create' | 'edit' | 'adjust', product }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [products, cats] = await Promise.all([
        listProducts({ ...filters, page }),
        listCategories(),
      ])
      setData(products)
      setCategories(cats.results)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { load() }, [load])

  const pageCount = Math.max(1, Math.ceil(data.count / 20))

  async function handleSave(payload) {
    if (modal?.type === 'edit') await updateProduct(modal.product.id, payload)
    else await createProduct(payload)
    setModal(null)
    load()
  }

  async function handleArchive(product) {
    await archiveProduct(product.id)
    load()
  }

  function setFilter(key) {
    return (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1) }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Produits</h1>
          <p>{data.count} référence(s) · stock et alertes en temps réel</p>
        </div>
        <button type="button" className="btn" onClick={() => setModal({ type: 'create' })}>
          Ajouter un produit
        </button>
      </div>

      <div className="filters card" style={{ padding: 14 }}>
        <div className="field">
          <label>Recherche</label>
          <input placeholder="Nom ou référence…" value={filters.search} onChange={setFilter('search')} />
        </div>
        <div className="field">
          <label>Catégorie</label>
          <select value={filters.category} onChange={setFilter('category')}>
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Taille</label>
          <select value={filters.size} onChange={setFilter('size')}>
            {SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label>État</label>
          <select value={filters.condition} onChange={setFilter('condition')}>
            {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Disponibilité</label>
          <select value={filters.availability} onChange={setFilter('availability')}>
            {AVAILABILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}
      {!loading && !error && data.results.length === 0 && (
        <EmptyState title="Aucun produit" message="Ajoutez votre premier vêtement." />
      )}

      {!loading && !error && data.results.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Référence</th><th>Nom</th><th>Catégorie</th><th>Taille</th>
                <th className="right">Achat</th><th className="right">Vente</th>
                <th className="right">Stock</th><th>État</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{p.sku}</td>
                  <td>
                    {p.image_url
                      ? <img src={p.image_url} alt="" width={34} height={34} style={{ objectFit: 'cover', borderRadius: 6, marginRight: 8, verticalAlign: 'middle' }} />
                      : null}
                    {p.name}
                  </td>
                  <td>{p.category_name ?? '—'}</td>
                  <td>{p.size}</td>
                  <td className="right num">{formatFCFA(p.purchase_price)}</td>
                  <td className="right num">{formatFCFA(p.sale_price)}</td>
                  <td className="right num">
                    {p.quantity}
                    {p.is_out_of_stock
                      ? <> <Badge tone="danger">Rupture</Badge></>
                      : p.is_low_stock ? <> <Badge tone="warning">Bas</Badge></> : null}
                  </td>
                  <td>{p.condition}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setModal({ type: 'edit', product: p })}>Modifier</button>{' '}
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setModal({ type: 'adjust', product: p })}>Stock</button>{' '}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleArchive(p)}>
                      {p.is_archived ? 'Désarchiver' : 'Archiver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} count={data.count} onPage={setPage} />

      {modal?.type === 'create' && (
        <Modal title="Ajouter un produit" onClose={() => setModal(null)}>
          <ProductForm categories={categories} onSubmit={handleSave} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title={`Modifier ${modal.product.sku}`} onClose={() => setModal(null)}>
          <ProductForm
            initial={{ ...EMPTY_FORM, ...modal.product, category: modal.product.category ?? '' }}
            categories={categories}
            onSubmit={handleSave}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === 'adjust' && (
        <Modal title="Ajustement de stock" onClose={() => setModal(null)}>
          <StockAdjust product={modal.product} onCancel={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
        </Modal>
      )}
    </>
  )
}
