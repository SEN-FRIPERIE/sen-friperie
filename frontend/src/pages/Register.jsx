import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FieldError } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const EMPTY = {
  first_name: '', last_name: '', email: '', phone: '',
  password: '', password_confirm: '',
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (form.password !== form.password_confirm) {
      setFieldErrors({ password_confirm: ['Les deux mots de passe ne correspondent pas.'] })
      return
    }

    setLoading(true)
    try {
      await register({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        password_confirm: form.password_confirm,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message ?? "Inscription impossible.")
      if (err.fields) setFieldErrors(err.fields)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 460 }}>
        <p style={{ textTransform: 'uppercase', letterSpacing: 2, fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
          Gestion de boutique
        </p>
        <h1 style={{ marginBottom: 4 }}>Créer un compte</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 22 }}>
          Votre compte sera créé avec le rôle <strong>Vendeur</strong>. Un administrateur
          pourra vous accorder des droits supplémentaires.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="first_name">Prénom</label>
              <input id="first_name" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} autoComplete="given-name" required />
              <FieldError message={fieldErrors.first_name?.[0]} />
            </div>
            <div className="field">
              <label htmlFor="last_name">Nom</label>
              <input id="last_name" value={form.last_name} onChange={(e) => update('last_name', e.target.value)} autoComplete="family-name" required />
              <FieldError message={fieldErrors.last_name?.[0]} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" required />
            <FieldError message={fieldErrors.email?.[0]} />
          </div>

          <div className="field">
            <label htmlFor="phone">Téléphone (facultatif)</label>
            <input id="phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="tel" />
            <FieldError message={fieldErrors.phone?.[0]} />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="password">Mot de passe</label>
              <input id="password" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} autoComplete="new-password" required />
              <FieldError message={fieldErrors.password?.[0]} />
            </div>
            <div className="field">
              <label htmlFor="password_confirm">Confirmer le mot de passe</label>
              <input id="password_confirm" type="password" value={form.password_confirm} onChange={(e) => update('password_confirm', e.target.value)} autoComplete="new-password" required />
              <FieldError message={fieldErrors.password_confirm?.[0]} />
            </div>
          </div>

          {error && (
            <p role="alert" style={{ color: 'var(--danger)', background: 'var(--danger-bg)', padding: '10px 12px', borderRadius: 8, fontSize: 14, marginBottom: 14 }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn btn--block" disabled={loading}>
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 14, marginTop: 18, color: 'var(--text-muted)' }}>
          Déjà un compte ? <Link to="/connexion">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
