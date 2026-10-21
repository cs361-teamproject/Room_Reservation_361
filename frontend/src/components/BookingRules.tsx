import type { CSSProperties } from 'react'
import lineIcon from '../assets/Line.png'
import { rolesLabel } from '../utils/bookingRules'
import type { RoomRules } from '../types/booking'

interface BookingRulesProps {
  /** This room's rules; the general rules below apply to every room */
  rules: RoomRules
  contactHref?: string
}

export default function BookingRules({ rules, contactHref = '#' }: BookingRulesProps) {
  const RULES = [
    `ห้องนี้จองได้ครั้งละไม่เกิน ${rules.max_hours} ชั่วโมง และเปิดให้${rolesLabel(rules.allowed_roles)}จองเท่านั้น`,
    'ระบุจำนวนผู้เข้าร่วมให้ไม่เกินความจุห้อง ทุกการจองต้องรอเจ้าหน้าที่อนุมัติก่อนเข้าใช้ห้อง',
    'ยกเลิกหรือแก้เวลาได้ที่หน้า “การจองของฉัน” ก่อนถึงเวลาเริ่มใช้ห้อง',
    'รักษาความสะอาดและเก็บอุปกรณ์ ให้อยู่ในสภาพเดิมก่อนออกจากห้อง',
  ]

  return (
    <section className="booking-rules" style={styles.section}>
      <h2 style={styles.heading}>การจองและกฎของการใช้งาน</h2>
      <div className="booking-rules-row" style={styles.row}>
        <ol style={styles.list}>
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <div className="booking-contact" style={styles.contactRow}>
          <span className="booking-office" style={styles.officeTag}>ติดต่อที่ : สำนักทะเบียน CSTU</span>
          <span style={styles.or}>หรือ</span>
          <a href={contactHref} className="booking-line" style={styles.lineBtn}>
            <img src={lineIcon} alt="LINE" style={styles.lineIcon} />
            <span>ติดต่อเจ้าหน้าที่</span>
          </a>
        </div>
      </div>
    </section>
  )
}

const styles: Record<string, CSSProperties> = {
  section: {
    marginTop: 28,
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    padding: '26px 28px 30px',
  },
  heading: { margin: '0 0 18px', fontSize: 19, fontWeight: 700, color: '#1a1a1a' },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 40,
    flexWrap: 'wrap',
  },
  list: {
    margin: 0,
    paddingLeft: 26,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 15,
    color: '#3a3a3a',
    lineHeight: 1.5,
  },
  contactRow: { display: 'flex', alignItems: 'center', gap: 20, flex: 'none' },
  officeTag: {
    display: 'flex',
    alignItems: 'center',
    height: 42,
    padding: '0 22px',
    background: '#111111',
    color: '#ffffff',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  or: { fontSize: 15, color: '#6b6b6b' },
  lineBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 42,
    padding: '0 22px',
    background: '#22C55E',
    color: '#ffffff',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
  },
  lineIcon: { width: 22, height: 22, borderRadius: 5, display: 'block', flex: 'none' },
}
