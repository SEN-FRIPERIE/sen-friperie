import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDemoMode } from '../services'
import Icon from './Icon'

const NAV = [
  { section: 'Boutique' },
  { to: '/', label: 'Tableau de bord', icon: 'dashboard' },
  { to: '/caisse', label: 'Caisse', icon: 'register' },
  { to: '/ventes', label: 'Ventes', icon: 'sales' },
  { section: 'Catalogue' },
  { to: '/produits', label: 'Produits', icon: 'products' },
  { to: '/categories', label: 'Catégories', icon: 'categories' },
  { to: '/approvisionnements', label: 'Approvisionnements', icon: 'purchases' },
  { section: 'Tiers' },
  { to: '/clients', label: 'Clients', icon: 'customers' },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: 'suppliers' },
  { section: 'Pilotage' },
  { to: '/rapports', label: 'Rapports', icon: 'reports' },
  { adminOnly: true, to: '/utilisateurs', label: 'Utilisateurs', icon: 'users' },
  { adminOnly: true, to: '/droits-acces', label: "Droits d'accès", icon: 'shield' },
  { adminOnly: true, to: '/journal', label: "Journal d'activité", icon: 'audit' },
  { adminOnly: true, to: '/parametres', label: 'Paramètres', icon: 'settings' },
]

const TITLES = {
  '/': 'Tableau de bord', '/caisse': 'Caisse', '/ventes': 'Ventes',
  '/produits': 'Produits', '/categories': 'Catégories',
  '/approvisionnements': 'Approvisionnements', '/clients': 'Clients',
  '/fournisseurs': 'Fournisseurs', '/rapports': 'Rapports',
  '/utilisateurs': 'Utilisateurs', '/droits-acces': "Droits d'accès",
  '/journal': "Journal d'activité", '/parametres': 'Paramètres', '/profil': 'Mon profil',
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setOpen(false) }, [location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/connexion')
  }

  const initials = (user?.display_name ?? user?.username ?? '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="app">
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar__brand">
          <strong>SEN-Friperie</strong>
          <span>Gestion de boutique</span>
        </div>
        <nav aria-label="Navigation principale">
          {NAV.map((item, i) =>
            item.section ? (
              <div key={`s${i}`} className="sidebar__section">{item.section}</div>
            ) : (!item.adminOnly || isAdmin) ? (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                <Icon name={item.icon} size="sm" />
                {item.label}
              </NavLink>
            ) : null,
          )}
        </nav>
        <div className="sidebar__footer">
          {isDemoMode() ? 'Mode démonstration' : 'Session sécurisée'}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Ouvrir le menu">
            <Icon name="menu" />
          </button>
          <span className="topbar__title">{TITLES[location.pathname] ?? 'SEN-Friperie'}</span>
          <div className="topbar__spacer" />
          <div className="topbar__user">
            <NavLink to="/profil" title="Mon profil" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
              <span className="avatar">{initials}</span>
              <span className="hide-sm">
                {user?.display_name}
                <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12 }}>
                  {isAdmin ? 'Administrateur' : 'Vendeur'}
                </small>
              </span>
            </NavLink>
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout} title="Se déconnecter">
              <Icon name="logout" size="sm" />
            </button>
          </div>
        </header>

        <main className="content">
          {isDemoMode() && (
            <div className="demo-banner" role="status">
              Mode démonstration actif — les données et ventes restent locales à cet onglet.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
