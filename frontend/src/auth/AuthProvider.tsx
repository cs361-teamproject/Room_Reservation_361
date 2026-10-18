import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { confirmSignIn, fetchAuthSession, signIn, signOut } from 'aws-amplify/auth'
import { authConfigured } from '../config/amplify'
import { ApiError } from '../services/api'
import { getMe } from '../services/users'
import { AuthContext, type AuthState, type LoginResult, type Me } from './context'

/**
 * Login with Cognito (Amplify keeps the tokens and refreshes them), then asks the API who we are:
 * the role lives in the User table, not in Cognito. Every API call sends the ID token as Bearer
 * (config/axios.ts).
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  // Without Cognito config nobody can log in, so there is nothing to wait for
  const [status, setStatus] = useState<AuthState['status']>(authConfigured ? 'loading' : 'anonymous')
  const [user, setUser] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** After any login: load /users/me, or go back to logged out if the API refuses the account */
  const loadMe = useCallback(async () => {
    try {
      const me = await getMe()
      setUser(me)
      setError(null)
      setStatus('authenticated')
    } catch (e) {
      // 403: Cognito knows the account but the User table does not
      setError(e instanceof ApiError && e.status === 403 ? 'บัญชีนี้ยังไม่ได้ลงทะเบียนในระบบจองห้อง กรุณาติดต่อเจ้าหน้าที่' : null)
      await signOut().catch(() => undefined)
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  // A session saved by an earlier visit (Amplify stores it in localStorage)
  useEffect(() => {
    if (!authConfigured) return
    fetchAuthSession()
      .then((session) => (session.tokens?.idToken ? loadMe() : setStatus('anonymous')))
      .catch(() => setStatus('anonymous'))
  }, [loadMe])

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      await signOut().catch(() => undefined) // a stale session makes signIn throw
      const { nextStep } = await signIn({ username: username.trim(), password })
      if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') return 'new-password'
      if (nextStep.signInStep !== 'DONE') throw new Error(`ยังไม่รองรับขั้นตอน ${nextStep.signInStep}`)
      await loadMe()
      return 'done'
    },
    [loadMe],
  )

  const setNewPassword = useCallback(
    async (password: string) => {
      const { nextStep } = await confirmSignIn({ challengeResponse: password })
      if (nextStep.signInStep !== 'DONE') throw new Error(`ยังไม่รองรับขั้นตอน ${nextStep.signInStep}`)
      await loadMe()
    },
    [loadMe],
  )

  const logout = useCallback(async () => {
    await signOut().catch(() => undefined)
    setUser(null)
    setError(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(
    () => ({ status, user, error, login, setNewPassword, logout }),
    [status, user, error, login, setNewPassword, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
