import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode } from '../services'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate(location.state?.from?.pathname ?? '/', { replace: true })
    } catch (err) {
      setError(err.message ?? 'Connexion impossible.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <p style={{ textTransform: 'uppercase', letterSpacing: 2, fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
          Gestion de boutique
        </p>
        <h1 style={{ marginBottom: 4 }}>SEN-Friperie</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 22 }}>
          Connectez-vous pour accéder à l&apos;application.
        </p>

        {isDemoMode() && (
          <p className="demo-banner" style={{ marginBottom: 16 }}>
            Mode démonstration : identifiant <strong>admin</strong> ou <strong>vendeur</strong>, mot de passe <strong>demo</strong>.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">E-mail ou identifiant</label>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && (
            <p role="alert" style={{ color: 'var(--danger)', background: 'var(--danger-bg)', padding: '10px 12px', borderRadius: 8, fontSize: 14, marginBottom: 14 }}>
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--block" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 14, marginTop: 18, color: 'var(--text-muted)' }}>
          Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      </div>
    </div>
  )
}
