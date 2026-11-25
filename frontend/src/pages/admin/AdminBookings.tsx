import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { secondaryBtn } from '../../components/buttons'
import { useAuth } from '../../auth/context'
import { useAdminContext } from '../../layouts/adminContext'
import BookingCalendar from './BookingCalendar'
import BookingRequestList from './BookingRequestList'

type View = 'calendar' | 'list'

const VIEWS: { value: View; label: string }[] = [
  { value: 'calendar', label: 'ปฏิทิน' },
  { value: 'list', label: 'รายการ' },
]

/** Booking requests: calendar (default) or the status list, picked with ?view= so it survives a reload */
export default function AdminBookings() {
  const { user } = useAuth()
  // Approving is STAFF only; ADMIN gets the same screens read-only (RequireRole guarantees a user)
  const canDecide = user?.role === 'STAFF'
  const { refreshPending } = useAdminContext()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'list' ? 'list' : 'calendar'
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = () => {
    setRefreshKey((k) => k + 1)
    refreshPending()
  }

  return (
    <div>
      <div className="admin-head" style={styles.headRow}>
        <h1 style={styles.heading}>คำขอจอง</h1>
        <div style={styles.headActions}>
          <div style={styles.segment} role="group" aria-label="รูปแบบการแสดงผล">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                aria-pressed={view === v.value}
                onClick={() => setParams(v.value === 'calendar' ? {} : { view: v.value }, { replace: true })}
                style={{ ...styles.segmentBtn, ...(view === v.value ? styles.segmentActive : null) }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button style={secondaryBtn} onClick={refresh}>
            ⟳ รีเฟรช
          </button>
        </div>
      </div>

      {!canDecide && <p style={styles.note}>ผู้ดูแลระบบดูรายการได้อย่างเดียว การอนุมัติทำโดยเจ้าหน้าที่</p>}

      {view === 'list' ? (
        <BookingRequestList canDecide={canDecide} refreshKey={refreshKey} />
      ) : (
        <BookingCalendar canDecide={canDecide} refreshKey={refreshKey} />
      )}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  heading: { margin: 0, fontSize: 26, fontWeight: 600 },
  headActions: { display: 'flex', alignItems: 'center', gap: 10 },
  segment: { display: 'flex', padding: 4, borderRadius: 10, background: '#EDEDED' },
  segmentBtn: {
    height: 32,
    padding: '0 16px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#4b4b4b',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  segmentActive: { background: '#ffffff', color: '#1a1a1a', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' },
  note: {
    margin: '0 0 16px',
    padding: '10px 14px',
    borderRadius: 8,
    background: '#F7F7F7',
    border: '1px solid #E5E5E5',
    fontSize: 14,
    color: '#4b4b4b',
  },
}
