import { Link } from 'react-router-dom'

export function Forbidden() {
  return (
    <div className="state">
      <h3>Accès refusé</h3>
      <p>Votre rôle ne permet pas d&apos;accéder à cette page.</p>
      <p style={{ marginTop: 14 }}><Link to="/">Retour au tableau de bord</Link></p>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="state">
      <h3>Page introuvable</h3>
      <p>La page demandée n&apos;existe pas ou a été déplacée.</p>
      <p style={{ marginTop: 14 }}><Link to="/">Retour au tableau de bord</Link></p>
    </div>
  )
}
