import { useCallback, useEffect, useState } from 'react'
import { fetchHealth } from '../services/health'

export const API_STATUS = {
  LOADING: 'loading',
  ONLINE: 'online',
  OFFLINE: 'offline',
}

function createInitialState() {
  return { status: API_STATUS.LOADING, data: null, error: null }
}

/**
 * Interroge l'endpoint /api/health/ et expose l'etat de l'API
 * (chargement, en ligne, hors ligne) ainsi qu'une fonction refresh().
 */
export function useApiHealth() {
  const [state, setState] = useState(createInitialState)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    async function run() {
      try {
        const data = await fetchHealth()
        if (active) {
          setState({ status: API_STATUS.ONLINE, data, error: null })
        }
      } catch (error) {
        if (active) {
          setState({ status: API_STATUS.OFFLINE, data: null, error })
        }
      }
    }

    run()

    return () => {
      active = false
    }
  }, [attempt])

  const refresh = useCallback(() => {
    setState(createInitialState())
    setAttempt((current) => current + 1)
  }, [])

  return { ...state, refresh }
}
