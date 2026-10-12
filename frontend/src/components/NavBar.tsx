import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/logo.png'

interface NavItem {
  label: string
  to: string
}

interface NavBarProps {
  items?: NavItem[]
}

// "การจองของฉัน" is shown to everyone until T3 adds login and role-based menus
const defaultItems: NavItem[] = [
  { label: 'All rooms', to: '/' },
  { label: 'การจองของฉัน', to: '/my-bookings' },
]

export default function NavBar({ items = defaultItems }: NavBarProps) {
  const location = useLocation()

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
}
