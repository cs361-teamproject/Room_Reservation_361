import type { ReactNode } from 'react'
import { useMockUser } from '../mocks/session'
import Forbidden from '../pages/Forbidden'
import type { UserRole } from '../types/booking'

/**
 * Shows the page only to these roles, a 403 page otherwise. UX only: the API checks roles itself.
 * The role comes from the mock session until T3 (then: not logged in → /login).
 */
export default function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const user = useMockUser()
  return roles.includes(user.role) ? children : <Forbidden />
}
