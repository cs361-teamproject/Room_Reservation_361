import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { primaryBtn } from '../components/buttons'

export default function Forbidden() {
  return (
    <main style={styles.main}>
      <span style={styles.code}>403</span>
      <h1 style={styles.title}>คุณไม่มีสิทธิ์เข้าหน้านี้</h1>
      <p style={styles.text}>หน้านี้เปิดให้เฉพาะบางบทบาท หากคิดว่าผิดพลาด กรุณาติดต่อเจ้าหน้าที่</p>
      <Link to="/" style={{ ...primaryBtn, textDecoration: 'none' }}>
        กลับหน้ารายการห้อง
      </Link>
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '96px 24px',
    textAlign: 'center',
  },
  code: { fontSize: 56, fontWeight: 700, color: '#F59E0B', lineHeight: 1 },
  title: { margin: 0, fontSize: 24, fontWeight: 700 },
  text: { margin: '0 0 12px', fontSize: 15, color: '#6b6b6b' },
}
