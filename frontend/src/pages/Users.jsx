import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, Modal, Spinner, Badge } from '../components/ui'
import { createUser, deactivateUser, listUsers, updateUser } from '../services'
import { useAuth } from '../context/AuthContext'

const EMPTY = {
  username: '', first_name: '', last_name: '', email: '', phone: '',
  role: 'VENDOR', password: '', is_active: true,
}

export default function Users() {
  const { user: me } = useAuth()
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listUsers())
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
    const payload = {
      username: form.username,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      role: form.role,
      is_active: form.is_active,
    }
    if (form.password) payload.password = form.password
    try {
      if (modal?.id) await updateUser(modal.id, payload)
      else await createUser(payload)
      setModal(null)
      load()
    } catch (err) {
      setFormError(err.fields ? Object.values(err.fields).flat()[0] : err.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Utilisateurs</h1>
          <p>Comptes et rôles. Les mots de passe sont chiffrés côté serveur (Django).</p>
        </div>
        <button type="button" className="btn" onClick={() => { setForm(EMPTY); setModal({}) }}>
          Créer un compte
        </button>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState error={error} onRetry={load} />}
      {!loading && !error && data.results.length === 0 && <EmptyState title="Aucun utilisateur" />}

      {!loading && !error && data.results.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Identifiant</th><th>Nom</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.results.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{u.username}</td>
                  <td>{u.display_name}</td>
                  <td><Badge tone={u.role === 'ADMIN' ? 'sage' : 'neutral'}>{u.role === 'ADMIN' ? 'Administrateur' : 'Vendeur'}</Badge></td>
                  <td><Badge tone={u.is_active ? 'success' : 'danger'}>{u.is_active ? 'Actif' : 'Désactivé'}</Badge></td>
                  <td>{u.last_login ? new Date(u.last_login).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button" className="btn btn--secondary btn--sm"
                      onClick={() => {
                        setForm({ ...EMPTY, ...u, password: '' })
                        setModal(u)
                      }}
                    >
                      Modifier
                    </button>{' '}
                    {u.id !== me?.id && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={async () => { await deactivateUser(u.id); load() }}>
                        {u.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? `Modifier ${modal.username}` : 'Créer un compte'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field"><label>Identifiant</label><input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required disabled={!!modal.id} /></div>
              <div className="field"><label>Mot de passe {modal.id ? '(laisser vide pour ne pas changer)' : '*'}</label><input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required={!modal.id} autoComplete="new-password" /></div>
              <div className="field"><label>Prénom</label><input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /></div>
              <div className="field"><label>Nom</label><input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} /></div>
              <div className="field"><label>E-mail</label><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div className="field"><label>Téléphone</label><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              <div className="field">
                <label>Rôle</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="VENDOR">Vendeur</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>
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
