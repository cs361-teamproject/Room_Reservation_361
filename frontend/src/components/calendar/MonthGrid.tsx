import type { CSSProperties } from 'react'
import type { Booking } from '../../types/booking'
import { dayNumber, formatMinutes, minutesInDay, weekdayLabel, weekdayOf } from '../../utils/bkkDate'
import { calendarChipStyle } from './chipStyle'

const MAX_CHIPS = 3

interface Props {
  /** 42 Bangkok dates from monthGrid() */
  days: string[]
  /** 'YYYY-MM' of the month being shown; other days are dimmed */
  month: string
  bookingsByDay: Map<string, Booking[]>
  today: string
  selectedDay: string | null
  highlightId: string | null
  onSelect: (bookingId: string) => void
  onPickDay: (day: string) => void
  /** "+N รายการ": show that day's week */
  onMore: (day: string) => void
}

/** Month view: up to 3 chips per day on desktop, dots on phones (.admin-cal-* in index.css) */
export default function MonthGrid({ days, month, bookingsByDay, today, selectedDay, highlightId, onSelect, onPickDay, onMore }: Props) {
  return (
    <div style={styles.grid} role="grid" aria-label="ปฏิทินรายเดือน">
      {days.slice(0, 7).map((day) => (
        <div key={`h-${day}`} style={{ ...styles.head, color: isWeekend(day) ? '#9a9a9a' : '#6b6b6b' }}>
          {weekdayLabel(day)}
        </div>
      ))}

      {days.map((day) => {
        const bookings = bookingsByDay.get(day) ?? []
        const pending = bookings.filter((b) => b.status === 'PENDING').length
        const outside = !day.startsWith(month)
        const past = day < today
        const selected = day === selectedDay
        return (
          <div
            key={day}
            className="admin-cal-cell"
            role="gridcell"
            tabIndex={0}
            aria-selected={selected}
            aria-label={`${day} มี ${bookings.length} รายการ${pending ? ` รออนุมัติ ${pending}` : ''}`}
            onClick={() => onPickDay(day)}
            onKeyDown={(e) => e.key === 'Enter' && onPickDay(day)}
            style={{
              ...styles.cell,
              background: past ? '#FAFAFA' : '#ffffff',
              opacity: outside ? 0.45 : 1,
              ...(selected ? styles.cellSelected : null),
            }}
          >
            <div style={styles.cellHead}>
              <span style={day === today ? styles.dayNumToday : styles.dayNum}>{dayNumber(day)}</span>
              {pending > 0 && <span style={styles.pendingDot} title={`รออนุมัติ ${pending} รายการ`} />}
            </div>

            <div className="admin-cal-chips" style={styles.chips}>
              {bookings.slice(0, MAX_CHIPS).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  title={`${b.room.room_name} ${b.title ?? ''}`.trim()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(b.id)
                  }}
                  style={{ ...styles.chip, ...calendarChipStyle(b.status, b.id === highlightId) }}
                >
                  <b style={styles.chipTime}>{formatMinutes(Math.max(0, minutesInDay(Date.parse(b.start_time), day)))}</b>
                  <span style={styles.chipRoom}>{b.room.room_name}</span>
                </button>
              ))}
              {bookings.length > MAX_CHIPS && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMore(day)
                  }}
                  style={styles.more}
                >
                  +{bookings.length - MAX_CHIPS} รายการ
                </button>
              )}
            </div>

            {/* Phones: one dot per booking instead of chips */}
            <div className="admin-cal-dots" style={styles.dots}>
              {bookings.slice(0, 4).map((b) => (
                <i key={b.id} style={{ ...styles.dot, background: b.status === 'PENDING' ? '#F59E0B' : '#1a1a1a' }} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const isWeekend = (day: string) => weekdayOf(day) === 0 || weekdayOf(day) === 6

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    border: '1px solid #ECECEC',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#ECECEC',
    gap: 1,
  },
  head: { padding: '8px 0', textAlign: 'center', fontSize: 13, fontWeight: 600, background: '#ffffff' },
  cell: {
    minHeight: 104,
    padding: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  cellSelected: { boxShadow: 'inset 0 0 0 2px #1a1a1a' },
  cellHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' },
  dayNum: { fontSize: 13, fontWeight: 600, color: '#1a1a1a', lineHeight: '24px' },
  dayNumToday: {
    fontSize: 12,
    fontWeight: 700,
    color: '#ffffff',
    background: '#1a1a1a',
    borderRadius: 999,
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDot: { width: 8, height: 8, borderRadius: 999, background: '#F59E0B' },
  chips: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    padding: '2px 6px',
    borderRadius: 6,
    fontFamily: 'inherit',
    fontSize: 12,
    lineHeight: 1.4,
    textAlign: 'left',
    cursor: 'pointer',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  chipTime: { flex: 'none', fontWeight: 700 },
  chipRoom: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  more: {
    padding: '1px 6px',
    border: 'none',
    background: 'transparent',
    color: '#4b4b4b',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
  },
  dots: { display: 'none', gap: 3, flexWrap: 'wrap', padding: '0 2px' },
  dot: { width: 6, height: 6, borderRadius: 999 },
}
