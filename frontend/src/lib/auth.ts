const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const TOKEN_KEY = "surie_token"

export interface AuthUser {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  institution_id: string
  is_active: boolean
  created_at: string
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? "Login failed")
  }
  const { access_token } = (await res.json()) as { access_token: string }
  localStorage.setItem(TOKEN_KEY, access_token)
  return getMe(access_token)
}

export async function register(data: {
  institution_name: string
  institution_type: string
  email: string
  password: string
  first_name: string
  last_name: string
}): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? "Registration failed")
  }
  const { access_token } = (await res.json()) as { access_token: string }
  localStorage.setItem(TOKEN_KEY, access_token)
  return getMe(access_token)
}

export async function getMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Unauthorized")
  return res.json() as Promise<AuthUser>
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY)
  window.location.href = "/login"
}
