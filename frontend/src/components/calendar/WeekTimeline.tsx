import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { DayBlock } from '../../types/booking'
import { dayNumber, formatMinutes, weekdayLabel, weekdayOf } from '../../utils/bkkDate'
import { calendarChipStyle } from './chipStyle'

// Visible hours; widened automatically when a booking falls outside them
const OPEN_MIN = 8 * 60
const CLOSE_MIN = 20 * 60
const HOUR_PX = 44

interface Props {
  days: string[]
  /** blocksForDay() of every room, so overlaps (different rooms) get lanes */
  blocksByDay: Map<string, DayBlock[]>
  today: string
  selectedDay: string | null
  highlightId: string | null
  onSelect: (bookingId: string) => void
  onPickDay: (day: string) => void
}

/** Week view of every room's bookings on an hour axis; scrolls sideways on phones */
export default function WeekTimeline({ days, blocksByDay, today, selectedDay, highlightId, onSelect, onPickDay }: Props) {
  const [open, close] = useMemo(() => {
    let lo = OPEN_MIN
    let hi = CLOSE_MIN
    for (const blocks of blocksByDay.values()) {
      for (const b of blocks) {
        lo = Math.min(lo, Math.floor(b.startMin / 60) * 60)
        hi = Math.max(hi, Math.ceil(b.endMin / 60) * 60)
      }
    }
    return [lo, hi]
  }, [blocksByDay])
  const height = ((close - open) / 60) * HOUR_PX
  const hours = Array.from({ length: (close - open) / 60 + 1 }, (_, i) => open + i * 60)

  return (
    <div className="admin-cal-week" style={styles.scroll}>
      <div style={styles.grid}>
        <div />
        {days.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onPickDay(day)}
            style={{ ...styles.dayHead, ...(day === selectedDay ? styles.dayHeadSelected : null) }}
          >
            <span style={{ fontSize: 13, color: isWeekend(day) ? '#9a9a9a' : '#6b6b6b' }}>{weekdayLabel(day)}</span>
            <span style={day === today ? styles.dayNumToday : styles.dayNum}>{dayNumber(day)}</span>
          </button>
        ))}

        <div style={{ position: 'relative', height }}>
          {hours.map((m) => (
            <span key={m} style={{ ...styles.hourLabel, top: ((m - open) / 60) * HOUR_PX }}>
              {formatMinutes(m)}
            </span>
          ))}
        </div>

        {days.map((day) => (
          <div key={day} style={dayColumn(height, day < today, isWeekend(day))}>
            {(blocksByDay.get(day) ?? []).map((block) => {
              const b = block.booking
              const s = Math.max(block.startMin, open)
              const e = Math.min(block.endMin, close)
              const time = `${formatMinutes(block.startMin)}–${formatMinutes(block.endMin)}`
              return (
                <button
                  key={b.id}
                  type="button"
                  title={`${b.room.room_name} ${time}${b.title ? ` · ${b.title}` : ''}`}
                  onClick={() => onSelect(b.id)}
                  style={{
                    ...styles.block,
                    ...calendarChipStyle(b.status, b.id === highlightId),
                    top: ((s - open) / 60) * HOUR_PX,
                    height: Math.max(((e - s) / 60) * HOUR_PX - 2, 18),
                    left: `calc(${(block.lane / block.lanes) * 100}% + 2px)`,
                    width: `calc(${100 / block.lanes}% - 4px)`,
                    zIndex: b.id === highlightId ? 3 : 1,
                  }}
                >
                  <span style={styles.blockRoom}>{b.room.room_name}</span>
                  <span style={styles.blockTime}>{time}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

const isWeekend = (day: string) => weekdayOf(day) === 0 || weekdayOf(day) === 6

const PAST_BG = 'repeating-linear-gradient(135deg, #f3f3f3 0 6px, #ffffff 6px 12px)'

function dayColumn(height: number, past: boolean, weekend: boolean): CSSProperties {
  const hourLines = `linear-gradient(to bottom, #ececec 1px, transparent 1px) 0 0 / 100% ${HOUR_PX}px`
  const base = past ? PAST_BG : weekend ? '#fafafa' : '#ffffff'
  return { position: 'relative', height, background: `${hourLines}, ${base}`, borderLeft: '1px solid #ececec' }
}

const styles: Record<string, CSSProperties> = {
  scroll: { overflowX: 'auto' },
  grid: { display: 'grid', gridTemplateColumns: '48px repeat(7, minmax(84px, 1fr))', rowGap: 8, minWidth: 640 },
  dayHead: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '4px 0',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  dayHeadSelected: { background: '#F3F4F6' },
  dayNum: { fontSize: 16, fontWeight: 600, color: '#1a1a1a', lineHeight: '28px' },
  dayNumToday: {
    fontSize: 14,
    fontWeight: 700,
    color: '#ffffff',
    background: '#1a1a1a',
    borderRadius: 999,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourLabel: { position: 'absolute', right: 6, transform: 'translateY(-50%)', fontSize: 11, color: '#9a9a9a' },
  block: {
    position: 'absolute',
    boxSizing: 'border-box',
    borderRadius: 6,
    padding: '3px 5px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
  },
  blockRoom: { fontSize: 12, fontWeight: 700, lineHeight: 1.25, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  blockTime: { fontSize: 11, opacity: 0.85, whiteSpace: 'nowrap' },
}
