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

/** Side menu on desktop, a row of tabs on phones (.admin-* in index.css) */
export default function AdminLayout() {
  // RequireRole only renders this for STAFF / ADMIN
  const user = useAuth().user!
  const pending = useAsync(`pending|${user.id}`, getPendingCount)
  const refreshPending = useCallback(() => pending.reload(), [pending])
  const count = pending.data ?? pending.previous

  return (
    <main className="admin-page" style={styles.main}>
      <div className="admin-shell" style={styles.shell}>
        <aside className="admin-side" style={styles.side}>
          <span className="admin-side-title" style={styles.sideTitle}>
            {user.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่'}
          </span>
          <nav className="admin-menu" style={styles.menu}>
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
        </aside>
        <section style={styles.content}>
          <Outlet context={{ refreshPending } satisfies AdminContext} />
        </section>
      </div>
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  main: { padding: '32px 40px 80px' },
  shell: { maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 28, alignItems: 'start' },
  side: {
    position: 'sticky',
    top: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
  },
  sideTitle: { padding: '4px 10px', fontSize: 13, color: '#6b6b6b' },
  menu: { display: 'flex', flexDirection: 'column', gap: 4 },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    height: 42,
    padding: '0 12px',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    color: '#1a1a1a',
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
