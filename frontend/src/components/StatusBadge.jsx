import { API_STATUS } from '../hooks/useApiHealth'

const LABELS = {
  [API_STATUS.LOADING]: 'Verification en cours...',
  [API_STATUS.ONLINE]: 'API accessible',
  [API_STATUS.OFFLINE]: 'API indisponible',
}

/**
 * Pastille de statut coloree (chargement / en ligne / hors ligne).
 */
function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {LABELS[status] ?? 'Statut inconnu'}
    </span>
  )
}

export default StatusBadge
