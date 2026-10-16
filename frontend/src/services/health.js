import { apiRequest } from './apiClient'

/**
 * Verifie l'etat de l'API backend.
 * @returns {Promise<{status: string, service: string, database: string, time: string}>}
 */
export function fetchHealth() {
  return apiRequest('/api/health/')
}
