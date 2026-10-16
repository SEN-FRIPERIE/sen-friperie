import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as service from '../services'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await service.fetchMe()
      setUser(me)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(async (username, password) => {
    const logged = await service.login(username, password)
    setUser(logged)
    return logged
  }, [])

  const register = useCallback(async (payload) => {
    const created = await service.register(payload)
    setUser(created)
    return created
  }, [])

  const logout = useCallback(async () => {
    await service.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, isAdmin: !!user?.is_admin_role }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
