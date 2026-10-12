import { useOutletContext } from 'react-router-dom'

export interface AdminContext {
  /** Call after approving/rejecting so the pending badge in the side menu updates */
  refreshPending: () => void
}

export const useAdminContext = () => useOutletContext<AdminContext>()
