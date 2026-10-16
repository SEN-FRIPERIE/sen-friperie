import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  if (!user) return null

  async function copyUsername() {
    try {
      await navigator.clipboard.writeText(user.username)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* presse-papiers indisponible */ }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Mon profil</h1>
          <p>Informations de votre compte.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <span className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
            {(user.display_name ?? user.username).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h2>{user.display_name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {user.is_admin_role ? 'Administrateur' : 'Vendeur'}
            </p>
          </div>
        </div>
        <dl style={{ display: 'grid', gap: 12, margin: 0, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <dt style={{ color: 'var(--text-muted)' }}>Identifiant</dt>
            <dd style={{ margin: 0, fontFamily: 'var(--mono)' }}>
              {user.username}{' '}
              <button type="button" className="btn btn--ghost btn--sm" onClick={copyUsername}>
                {copied ? 'Copié' : 'Copier'}
              </button>
            </dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <dt style={{ color: 'var(--text-muted)' }}>E-mail</dt>
            <dd style={{ margin: 0 }}>{user.email || '—'}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <dt style={{ color: 'var(--text-muted)' }}>Téléphone</dt>
            <dd style={{ margin: 0 }}>{user.phone || '—'}</dd>
          </div>
        </dl>
      </div>
    </>
  )
}
