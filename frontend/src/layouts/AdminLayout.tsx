import { useCallback } from 'react'
import type { CSSProperties } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/context'
import { getPendingCount } from '../services/admin'
import type { UserRole } from '../types/booking'
import type { AdminContext } from './adminContext'

interface MenuItem {
  to: string
  label: string
  roles: UserRole[]
}

const MENU: MenuItem[] = [
  { to: '/admin/bookings', label: 'คำขอจอง', roles: ['STAFF', 'ADMIN'] },
  { to: '/admin/rooms', label: 'จัดการห้อง', roles: ['STAFF', 'ADMIN'] },
  { to: '/admin/stats', label: 'สถิติ', roles: ['ADMIN'] },
]

/** Section tabs above the page; the content gets the full width (.admin-* in index.css) */
export default function AdminLayout() {
  // RequireRole only renders this for STAFF / ADMIN
  const user = useAuth().user!
  const pending = useAsync(`pending|${user.id}`, getPendingCount)
  const refreshPending = useCallback(() => pending.reload(), [pending])
  const count = pending.data ?? pending.previous

  return (
    <main className="admin-page" style={styles.main}>
      <div style={styles.shell}>
        <nav className="admin-menu" style={styles.menu} aria-label="เมนูผู้ดูแล">
          {MENU.filter((m) => m.roles.includes(user.role)).map((m) => (
            <NavLink key={m.to} to={m.to} style={({ isActive }) => ({ ...styles.item, ...(isActive ? styles.itemActive : null) })}>
              {({ isActive }) => (
                <>
                  <span>{m.label}</span>
                  {m.to === '/admin/bookings' && Boolean(count) && (
                    <span style={{ ...styles.badge, ...(isActive ? styles.badgeActive : null) }}>{count}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <section style={styles.content}>
          <Outlet context={{ refreshPending } satisfies AdminContext} />
        </section>
      </div>
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  main: { padding: '24px 40px 80px' },
  shell: { maxWidth: 1240, margin: '0 auto' },
  menu: {
    display: 'flex',
    gap: 6,
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: '1px solid #ECECEC',
    overflowX: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 38,
    padding: '0 16px',
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 600,
    color: '#4b4b4b',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  itemActive: { background: '#1a1a1a', color: '#ffffff' },
  badge: {
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    borderRadius: 999,
    background: '#F59E0B',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
  },
  badgeActive: { background: '#ffffff', color: '#1a1a1a' },
  content: { minWidth: 0 },
}
