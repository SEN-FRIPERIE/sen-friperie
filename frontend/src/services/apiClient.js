/**
 * Client HTTP minimal pour communiquer avec l'API Django REST Framework.
 *
 * L'URL de base provient de la variable d'environnement VITE_API_BASE_URL.
 * - Vide en developpement : les appels sont relatifs ("/api/...") et passes
 *   par le proxy Vite.
 * - Renseignee en production : origine complete du backend (sans "/api").
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, { status = null, cause = undefined } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    if (cause !== undefined) {
      this.cause = cause
    }
  }
}

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

/**
 * Effectue une requete JSON et leve une ApiError en cas d'echec.
 * @param {string} path Chemin de l'endpoint, ex. "/api/health/".
 * @param {RequestInit} [options]
 */
export async function apiRequest(path, options = {}) {
  const { headers, ...rest } = options

  let response
  try {
    response = await fetch(buildUrl(path), {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...headers,
      },
    })
  } catch (cause) {
    throw new ApiError(
      "Impossible de contacter l'API. Verifiez que le serveur Django est demarre.",
      { cause },
    )
  }

  if (!response.ok) {
    throw new ApiError(`L'API a repondu avec le statut ${response.status}.`, {
      status: response.status,
    })
  }

  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new ApiError("La reponse de l'API n'est pas un JSON valide.", {
      status: response.status,
      cause,
    })
  }
}
