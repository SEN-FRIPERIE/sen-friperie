import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { formatFCFA } from '../lib/format'
import { createSale, fetchShopSettings, listCustomers, listProducts } from '../services'

export default function Caisse() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState(null)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // { product, quantity }
  const [discount, setDiscount] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [payment, setPayment] = useState('CASH')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [saleError, setSaleError] = useState(null)
  const idempotencyKey = useRef(null)

  useEffect(() => {
    idempotencyKey.current = `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prods, clients, shop] = await Promise.all([
        listProducts({ availability: 'in_stock', page_size: 100 }),
        listCustomers(),
        fetchShopSettings(),
      ])
      setProducts(prods.results)
      setCustomers(clients.results)
      setSettings(shop)
      if (shop?.payment_methods?.length) setPayment(shop.payment_methods[0])
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 30)
    const q = search.toLowerCase()
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 30)
  }, [products, search])

  function addToCart(product) {
    setCart((c) => {
      const existing = c.find((l) => l.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.quantity) return c
        return c.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [...c, { product, quantity: 1 }]
    })
  }

  function setQty(productId, qty) {
    setCart((c) => c
      .map((l) => (l.product.id === productId
        ? { ...l, quantity: Math.max(0, Math.min(qty, l.product.quantity)) }
        : l))
      .filter((l) => l.quantity > 0))
  }

  const subtotal = cart.reduce((sum, l) => sum + Number(l.product.sale_price) * l.quantity, 0)
  const discountValue = Math.max(0, Math.min(Number(discount) || 0, subtotal))
  const total = subtotal - discountValue

  async function handleCheckout(e) {
    e.preventDefault()
    setSaleError(null)
    if (cart.length === 0) { setSaleError('Le panier est vide.'); return }
    setSubmitting(true)
    try {
      const sale = await createSale({
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        payment_method: payment,
        customer: customerId ? Number(customerId) : null,
        discount: String(discountValue),
        idempotency_key: idempotencyKey.current,
      })
      navigate(`/ventes/${sale.id}?recu=1`)
    } catch (err) {
      setSaleError(err.message ?? 'Vente impossible.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={load} />

  const paymentOptions = (settings?.payment_methods?.length
    ? settings.payment_methods
    : ['CASH', 'WAVE', 'ORANGE_MONEY', 'MOOV_MONEY'])

  const PAYMENT_LABELS = {
    CASH: 'Espèces', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money',
    MOOV_MONEY: 'Moov Money', CARD: 'Carte bancaire', OTHER: 'Autre',
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Caisse</h1>
          <p>Recherchez, ajoutez au panier, encaissez. Les totaux sont recalculés par le serveur.</p>
        </div>
      </div>

      <div className="pos">
        <section className="card">
          <div className="field">
            <label htmlFor="pos-search">Rechercher un produit</label>
            <input
              id="pos-search"
              placeholder="Nom ou référence…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="Aucun produit trouvé" message="Vérifiez le stock dans la page Produits." />
          ) : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="data">
                <thead>
                  <tr><th>Réf.</th><th>Produit</th><th className="right">Prix</th><th className="right">Stock</th><th /></tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.sku}</td>
                      <td>{p.name}</td>
                      <td className="right num">{formatFCFA(p.sale_price)}</td>
                      <td className="right num">{p.quantity}</td>
                      <td className="right">
                        <button type="button" className="btn btn--sm" onClick={() => addToCart(p)}>
                          Ajouter
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form className="card" onSubmit={handleCheckout}>
          <h2 style={{ marginBottom: 12 }}>Panier</h2>
          {cart.length === 0 ? (
            <EmptyState title="Panier vide" message="Cliquez sur « Ajouter » pour commencer." />
          ) : (
            <div>
              {cart.map((l) => (
                <div className="pos__cart-line" key={l.product.id}>
                  <div style={{ flex: 1 }}>
                    <strong>{l.product.name}</strong>
                    <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                      {formatFCFA(l.product.sale_price)} × {l.quantity} = {formatFCFA(Number(l.product.sale_price) * l.quantity)}
                    </small>
                  </div>
                  <input
                    type="number" min="1" max={l.product.quantity} value={l.quantity}
                    onChange={(e) => setQty(l.product.id, Number(e.target.value))}
                    style={{ width: 64, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 7 }}
                    aria-label={`Quantité pour ${l.product.name}`}
                  />
                  <button
                    type="button" className="btn btn--ghost btn--sm"
                    onClick={() => setQty(l.product.id, 0)} aria-label="Retirer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="field" style={{ marginTop: 16 }}>
            <label>Client (facultatif)</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Client comptoir</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Mode de paiement</label>
            <select value={payment} onChange={(e) => setPayment(e.target.value)}>
              {paymentOptions.map((m) => (
                <option key={m} value={m}>{PAYMENT_LABELS[m] ?? m}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Remise (FCFA)</label>
            <input type="number" min="0" max={subtotal} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>

          <div className="pos__total">
            <span>Total</span>
            <span>{formatFCFA(total)}</span>
          </div>

          {saleError && (
            <p role="alert" style={{ color: 'var(--danger)', background: 'var(--danger-bg)', padding: '10px 12px', borderRadius: 8, marginTop: 12, fontSize: 14 }}>
              {saleError}
            </p>
          )}

          <button type="submit" className="btn btn--block" style={{ marginTop: 14 }} disabled={submitting || cart.length === 0}>
            {submitting ? 'Enregistrement…' : `Encaisser ${formatFCFA(total)}`}
          </button>
        </form>
      </div>
    </>
  )
}
