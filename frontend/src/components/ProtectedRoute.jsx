import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="state">
        <div className="spinner" />
        <p style={{ marginTop: 12 }}>Chargement…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/connexion" replace state={{ from: location }} />
  if (adminOnly && !isAdmin) return <Navigate to="/acces-refuse" replace />
  return <Outlet />
}
