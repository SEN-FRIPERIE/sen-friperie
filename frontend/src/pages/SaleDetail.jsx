import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ErrorState, Modal, Spinner, Badge } from '../components/ui'
import { formatDateTime, formatFCFA } from '../lib/format'
import { cancelSale, getSale, saleReceipt } from '../services'

export default function SaleDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [sale, setSale] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, r] = await Promise.all([getSale(id), saleReceipt(id)])
      setSale(s)
      setReceipt(r)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleCancel() {
    setBusy(true)
    setActionError(null)
    try {
      await cancelSale(id, reason)
      setConfirmCancel(false)
      await load()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={load} />
  if (!sale) return <ErrorState error="Vente introuvable." />

  const shop = receipt?.shop
  const showReceipt = searchParams.get('recu') === '1'

  return (
    <>
      <div className="page-header">
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <Link to="/ventes">← Retour aux ventes</Link>
          </p>
          <h1>Vente {sale.number}</h1>
          <p>
            {formatDateTime(sale.created_at)} · {sale.seller_name}{' '}
            <Badge tone={sale.status === 'COMPLETED' ? 'success' : 'danger'}>{sale.status_display}</Badge>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }} className="no-print">
          <button type="button" className="btn btn--secondary" onClick={() => window.print()}>
            Imprimer le reçu
          </button>
          {sale.status === 'COMPLETED' && (
            <button type="button" className="btn btn--danger" onClick={() => setConfirmCancel(true)}>
              Annuler la vente
            </button>
          )}
        </div>
      </div>

      {showReceipt && (
        <p className="demo-banner no-print" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
          Vente enregistrée avec succès.
        </p>
      )}

      <div className="two-col">
        <section className="card">
          <h2 style={{ marginBottom: 14 }}>Articles</h2>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Produit</th><th className="right">Prix unitaire</th>
                  <th className="right">Qté</th><th className="right">Coût unitaire</th><th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.product_name}</strong>
                      <small style={{ display: 'block', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{item.product_sku}</small>
                    </td>
                    <td className="right num">{formatFCFA(item.unit_price)}</td>
                    <td className="right num">{item.quantity}</td>
                    <td className="right num">{formatFCFA(item.unit_cost)}</td>
                    <td className="right num">{formatFCFA(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl style={{ display: 'grid', gap: 8, marginTop: 18, justifyItems: 'end' }}>
            <div style={{ display: 'flex', gap: 30 }}><dt>Remise</dt><dd className="num" style={{ margin: 0 }}>{formatFCFA(sale.discount)}</dd></div>
            <div style={{ display: 'flex', gap: 30 }}><dt><strong>Total</strong></dt><dd className="num" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{formatFCFA(sale.total_amount)}</dd></div>
            <div style={{ display: 'flex', gap: 30 }}><dt>Coût des marchandises</dt><dd className="num" style={{ margin: 0 }}>{formatFCFA(sale.cost_amount)}</dd></div>
            <div style={{ display: 'flex', gap: 30 }}><dt>Bénéfice brut estimé</dt><dd className="num" style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>{formatFCFA(sale.gross_profit)}</dd></div>
          </dl>
          {sale.status === 'CANCELLED' && (
            <p style={{ marginTop: 16, color: 'var(--danger)', fontSize: 14 }}>
              Annulée le {formatDateTime(sale.cancelled_at)}
              {sale.cancellation_reason ? ` — motif : ${sale.cancellation_reason}` : ''}
            </p>
          )}
        </section>

        <section className="card">
          <h2 style={{ marginBottom: 14 }}>Reçu</h2>
          <div className="receipt">
            <h3>{shop?.name ?? 'SEN-Friperie'}</h3>
            {shop?.address && <p style={{ textAlign: 'center' }}>{shop.address}</p>}
            {shop?.phone && <p style={{ textAlign: 'center' }}>{shop.phone}</p>}
            {shop?.receipt_header && <p style={{ textAlign: 'center', marginTop: 6 }}>{shop.receipt_header}</p>}
            <hr />
            <div className="line"><span>Vente</span><span>{sale.number}</span></div>
            <div className="line"><span>Date</span><span>{formatDateTime(sale.created_at)}</span></div>
            <div className="line"><span>Client</span><span>{sale.customer_name ?? 'Comptoir'}</span></div>
            <div className="line"><span>Vendeur</span><span>{sale.seller_name}</span></div>
            <hr />
            {sale.items.map((item) => (
              <div className="line" key={item.id}>
                <span>{item.quantity} × {item.product_name}</span>
                <span>{formatFCFA(item.line_total)}</span>
              </div>
            ))}
            <hr />
            <div className="line"><span>Sous-total</span><span>{formatFCFA(Number(sale.total_amount) + Number(sale.discount))}</span></div>
            {Number(sale.discount) > 0 && <div className="line"><span>Remise</span><span>-{formatFCFA(sale.discount)}</span></div>}
            <div className="line" style={{ fontWeight: 700 }}><span>TOTAL</span><span>{formatFCFA(sale.total_amount)}</span></div>
            <div className="line"><span>Paiement</span><span>{sale.payment_method_display}</span></div>
            <hr />
            {shop?.receipt_footer && <p style={{ textAlign: 'center' }}>{shop.receipt_footer}</p>}
          </div>
        </section>
      </div>

      {confirmCancel && (
        <Modal title={`Annuler la vente ${sale.number} ?`} onClose={() => setConfirmCancel(false)}>
          <p style={{ fontSize: 14, marginBottom: 14 }}>
            Le stock sera restauré et l&apos;annulation tracée. Cette action est irréversible.
          </p>
          <div className="field">
            <label>Motif (facultatif)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {actionError && <p role="alert" style={{ color: 'var(--danger)' }}>{actionError}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--secondary" onClick={() => setConfirmCancel(false)}>Retour</button>
            <button type="button" className="btn btn--danger" onClick={handleCancel} disabled={busy}>
              {busy ? 'Annulation…' : 'Confirmer l\'annulation'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
