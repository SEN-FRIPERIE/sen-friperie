/**
 * Client HTTP pour l'API Django REST Framework.
 * - Sessions cookie : `credentials: 'include'`.
 * - CSRF : récupère le cookie via /api/auth/csrf/ puis envoie X-CSRFToken.
 * - Erreurs normalisées : ApiError { status, detail, fields }.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, { status = null, fields = null, cause = undefined } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
    if (cause !== undefined) this.cause = cause
  }
}

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

let csrfPromise = null

async function ensureCsrfToken() {
  if (getCookie('csrftoken')) return
  if (!csrfPromise) {
    csrfPromise = fetch(buildUrl('/api/auth/csrf/'), {
      credentials: 'include',
    }).finally(() => { csrfPromise = null })
  }
  await csrfPromise
}

export async function apiRequest(path, options = {}) {
  const { headers, ...rest } = options
  const method = (rest.method ?? 'GET').toUpperCase()

  if (method !== 'GET' && method !== 'HEAD') {
    await ensureCsrfToken()
  }

  let response
  try {
    response = await fetch(buildUrl(path), {
      credentials: 'include',
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(rest.body && !(rest.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(getCookie('csrftoken') ? { 'X-CSRFToken': getCookie('csrftoken') } : {}),
        ...headers,
      },
    })
  } catch (cause) {
    throw new ApiError(
      "Impossible de contacter l'API. Vérifiez que le serveur Django est démarré.",
      { cause },
    )
  }

  if (response.status === 204) return null

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const detail =
      data?.detail ||
      (response.status === 401
        ? 'Session expirée ou identifiants invalides.'
        : response.status === 403
          ? "Vous n'avez pas les droits nécessaires."
          : `L'API a répondu avec le statut ${response.status}.`)
    throw new ApiError(detail, {
      status: response.status,
      fields: data?.fields ?? null,
    })
  }

  return data
}

export const api = {
  get: (path) => apiRequest(path),
  post: (path, body) =>
    apiRequest(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: (path, body) =>
    apiRequest(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: (path, body) =>
    apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
}
