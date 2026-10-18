import type { CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import { useAuth } from '../auth/context'
import type { UserRole } from '../types/booking'
import { ROLE_LABELS } from '../utils/bookingRules'
import { primaryBtn, secondaryBtn } from './buttons'

interface NavItem {
  label: string
  to: string
}

interface NavBarProps {
  items?: NavItem[]
}

// Menus per role (logged out: rooms only). The pages check the role again (RequireRole).
function itemsFor(role: UserRole | undefined): NavItem[] {
  const items: NavItem[] = [{ label: 'All rooms', to: '/' }]
  if (role === 'STUDENT' || role === 'LECTURER') items.push({ label: 'การจองของฉัน', to: '/my-bookings' })
  if (role === 'STAFF' || role === 'ADMIN') items.push({ label: 'Admin', to: '/admin' })
  return items
}

export default function NavBar({ items }: NavBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { status, user, logout } = useAuth()
  // The login page keeps only the logo: no menu to wander off to
  const onLogin = location.pathname.startsWith('/login')
  items ??= onLogin ? [] : itemsFor(user?.role)
  const loginHref = `/login?next=${encodeURIComponent(location.pathname + location.search)}`

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
          {user ? (
            <>
              <span style={styles.userName}>{user.display_name ?? user.username}</span>
              <span style={styles.roleTag}>{ROLE_LABELS[user.role]}</span>
              <button
                style={{ ...secondaryBtn, ...styles.smallBtn }}
                onClick={async () => {
                  await logout()
                  navigate('/')
                }}
              >
                ออกจากระบบ
              </button>
            </>
          ) : (
            status === 'anonymous' &&
            !onLogin && (
              <Link to={loginHref} style={{ ...primaryBtn, ...styles.smallBtn, textDecoration: 'none' }}>
                เข้าสู่ระบบ
              </Link>
            )
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
  roleTag: {
    padding: '3px 10px',
    borderRadius: 999,
    background: '#F3F3F3',
    fontSize: 13,
    fontWeight: 600,
    color: '#4b4b4b',
    whiteSpace: 'nowrap',
  },
  smallBtn: { height: 36, padding: '0 14px', fontSize: 14 },
}
