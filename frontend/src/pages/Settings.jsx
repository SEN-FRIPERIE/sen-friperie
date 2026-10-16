import { useCallback, useEffect, useState } from 'react'
import { ErrorState, Spinner } from '../components/ui'
import { fetchShopSettings, updateShopSettings } from '../services'

const PAYMENT_OPTIONS = [
  ['CASH', 'Espèces'], ['WAVE', 'Wave'], ['ORANGE_MONEY', 'Orange Money'],
  ['MOOV_MONEY', 'Moov Money'], ['CARD', 'Carte bancaire'], ['OTHER', 'Autre'],
]

export default function Settings() {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setForm(await fetchShopSettings())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      setForm(await updateShopSettings(form))
      setSaved(true)
    } catch (err) {
      setSaveError(err.fields ? Object.values(err.fields).flat()[0] : err.message)
    } finally {
      setSaving(false)
    }
  }

  function togglePayment(code) {
    setForm((f) => {
      const current = f.payment_methods ?? []
      return {
        ...f,
        payment_methods: current.includes(code)
          ? current.filter((c) => c !== code)
          : [...current, code],
      }
    })
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={load} />
  if (!form) return null

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Paramètres de la boutique</h1>
          <p>Informations affichées sur les reçus et modes de paiement proposés à la caisse.</p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 720 }}>
        <div className="form-grid">
          <div className="field"><label>Nom de la boutique</label><input value={form.shop_name} onChange={(e) => setForm((f) => ({ ...f, shop_name: e.target.value }))} required /></div>
          <div className="field"><label>Téléphone</label><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
          <div className="field"><label>E-mail</label><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div className="field"><label>Adresse</label><input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
          <div className="field"><label>Devise</label><input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} /></div>
          <div className="field"><label>Seuil d&apos;alerte par défaut</label><input type="number" min="0" value={form.default_low_stock_threshold} onChange={(e) => setForm((f) => ({ ...f, default_low_stock_threshold: Number(e.target.value) }))} /></div>
        </div>

        <div className="field"><label>En-tête du reçu</label><textarea rows={2} value={form.receipt_header} onChange={(e) => setForm((f) => ({ ...f, receipt_header: e.target.value }))} /></div>
        <div className="field"><label>Pied de reçu</label><textarea rows={2} value={form.receipt_footer} onChange={(e) => setForm((f) => ({ ...f, receipt_footer: e.target.value }))} /></div>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
          <legend style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Modes de paiement actifs</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {PAYMENT_OPTIONS.map(([code, label]) => (
              <label key={code} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={(form.payment_methods ?? []).includes(code)}
                  onChange={() => togglePayment(code)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {saveError && <p role="alert" style={{ color: 'var(--danger)', marginBottom: 12 }}>{saveError}</p>}
        {saved && <p style={{ color: 'var(--success)', marginBottom: 12 }}>Paramètres enregistrés.</p>}
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
        </button>
      </form>
    </>
  )
}
