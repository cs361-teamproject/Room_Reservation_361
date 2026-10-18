import { createContext, useContext } from 'react'
import type { UserRole } from '../types/booking'

/** GET /api/users/me */
export interface Me {
  id: string
  username: string
  display_name: string | null
  role: UserRole
}

export type LoginResult = 'done' | 'new-password'

export interface AuthState {
  /** loading until the stored session (if any) has been checked */
  status: 'loading' | 'anonymous' | 'authenticated'
  user: Me | null
  /** Set when Cognito accepts the login but the API does not know the account */
  error: string | null
  login: (username: string, password: string) => Promise<LoginResult>
  /** Second step for accounts created with a temporary password (FORCE_CHANGE_PASSWORD) */
  setNewPassword: (password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth() must be used inside <AuthProvider>')
  return auth
}
