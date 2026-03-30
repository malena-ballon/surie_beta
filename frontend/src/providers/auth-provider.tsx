"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { type AuthUser, getMe, getToken, logout as authLogout, login as authLogin } from "@/lib/auth"

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => { throw new Error("not ready") },
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    getMe(token)
      .then(setUser)
      .catch(() => localStorage.removeItem("surie_token"))
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const u = await authLogin(email, password)
    setUser(u)
    return u
  }

  const logout = () => {
    setUser(null)
    authLogout()
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
