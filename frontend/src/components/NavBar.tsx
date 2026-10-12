import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/logo.png'
import { USE_MOCK_API } from '../config/mock'
import { MOCK_USERS, ROLE_LABELS, setMockRole, useMockUser } from '../mocks/session'
import type { UserRole } from '../types/booking'

interface NavItem {
  label: string
  to: string
}

interface NavBarProps {
  items?: NavItem[]
}

// Menus per role; the role comes from the mock session until T3 adds real login
function itemsFor(role: UserRole): NavItem[] {
  const items: NavItem[] = [{ label: 'All rooms', to: '/' }]
  if (role === 'STUDENT' || role === 'LECTURER') items.push({ label: 'การจองของฉัน', to: '/my-bookings' })
  if (role === 'STAFF' || role === 'ADMIN') items.push({ label: 'Admin', to: '/admin' })
  return items
}

export default function NavBar({ items }: NavBarProps) {
  const location = useLocation()
  const user = useMockUser()
  items ??= itemsFor(user.role)

  return (
    <header style={styles.header}>
      <div className="navbar-inner" style={styles.inner}>
        <Link to="/" style={styles.logoLink} reloadDocument>
          <img src={logo} alt="Computer Science, Thammasat University" style={styles.logo} />
        </Link>
        <nav style={styles.nav}>
          {items.map((item) => {
            const active =
              item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.label}
                to={item.to}
                reloadDocument={item.to === '/'}
                style={{ ...styles.link, ...(active ? styles.linkActive : null) }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="navbar-user" style={styles.user}>
          <span style={styles.userName}>{user.display_name}</span>
          {USE_MOCK_API && (
            <label style={styles.switcher} title="ทดลองใช้ระบบในบทบาทต่าง ๆ จนกว่าจะมีระบบ login (T3)">
              <span style={styles.switcherTag}>Mock</span>
              <select
                value={user.role}
                onChange={(e) => setMockRole(e.target.value as UserRole)}
                style={styles.switcherSelect}
                aria-label="สลับบทบาท (mock)"
              >
                {(Object.keys(MOCK_USERS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </header>
  )
}

const styles: Record<string, CSSProperties> = {
  header: {
    background: '#ffffff',
    boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
    fontFamily: "'IBM Plex Sans Thai', sans-serif",
    color: '#1a1a1a',
  },
  inner: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 56,
    height: 88,
    maxWidth: 1320,
    margin: '0 auto',
    padding: '0 40px',
  },
  logoLink: { display: 'flex', alignItems: 'center', flex: 'none' },
  logo: { height: 52, width: 'auto', display: 'block' },
  nav: { display: 'flex', alignItems: 'stretch', gap: 32 },
  link: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 4px',
    fontSize: 17,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    color: '#1a1a1a',
    textDecoration: 'none',
    borderBottom: '4px solid transparent',
  },
  linkActive: { borderBottomColor: '#F59E0B' },
  user: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 },
  userName: { fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' },
  switcher: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 34,
    padding: '0 4px 0 8px',
    borderRadius: 999,
    border: '1.5px dashed #F59E0B',
    background: '#FFF7ED',
  },
  switcherTag: { fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' },
  switcherSelect: {
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    color: '#1a1a1a',
    cursor: 'pointer',
    outline: 'none',
  },
}
