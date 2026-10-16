import { useEffect } from 'react'
import Icon from './Icon'

export function Spinner({ label = 'Chargement…' }) {
  return (
    <div className="state" role="status">
      <div className="spinner" />
      <p style={{ marginTop: 10 }}>{label}</p>
    </div>
  )
}

export function EmptyState({ title = 'Aucune donnée', message, action }) {
  return (
    <div className="state">
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const message =
    typeof error === 'string' ? error : error?.message ?? 'Une erreur est survenue.'
  return (
    <div className="state state--error" role="alert">
      <Icon name="alert" />
      <h3 style={{ color: 'var(--danger)' }}>Erreur</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--secondary" style={{ marginTop: 14 }} onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  )
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__header">
          <h2>{title}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Pagination({ page, pageCount, count, onPage }) {
  if (pageCount <= 1) return null
  return (
    <div className="pagination">
      <button type="button" className="btn btn--secondary btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Précédent
      </button>
      <span>Page {page} / {pageCount} · {count} élément(s)</span>
      <button type="button" className="btn btn--secondary btn--sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        Suivant
      </button>
    </div>
  )
}

export function FieldError({ message }) {
  if (!message) return null
  return <span className="error">{message}</span>
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
