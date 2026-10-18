import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/context'
import Forbidden from '../pages/Forbidden'
import type { UserRole } from '../types/booking'

/**
 * Shows the page only to these roles: logged out goes to /login (and back here afterwards),
 * a wrong role sees the 403 page. UX only — the API checks the role on every call.
 */
export default function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <div style={{ minHeight: '60vh' }} />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return roles.includes(user.role) ? children : <Forbidden />
}
