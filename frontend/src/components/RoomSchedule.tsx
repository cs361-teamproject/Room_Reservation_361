import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useAsync } from '../hooks/useAsync'
import { getRoomBookings } from '../services/bookings'
import type { Booking, DayBlock } from '../types/booking'
import { blocksForDay } from '../utils/scheduleLayout'
import {
  addDays,
  bkkToday,
  dayNumber,
  formatMinutes,
  nowMinutes,
  startOfWeek,
  weekDays,
  weekRangeLabel,
  weekdayLabel,
  weekdayOf,
} from '../utils/bkkDate'

// Visible hours; widened automatically when a booking falls outside them
const OPEN_MIN = 8 * 60
const CLOSE_MIN = 20 * 60
const HOUR_PX = 34
// Booking rule: at most 7 days in advance
const BOOKABLE_DAYS = 7

const TYPE_LABEL: Record<Booking['booking_type'], string> = {
  CLASS: 'คาบเรียน',
  SCHEDULE: 'ตารางสอบ/กิจกรรม',
  SPECIAL_EVENT: 'กิจกรรมพิเศษ',
  STUDENT_BOOKING: 'จองแล้ว',
}

const blockLabel = (b: Booking) => b.title ?? TYPE_LABEL[b.booking_type]

interface RoomScheduleProps {
  roomId: string
  /** Room is not AVAILABLE (e.g. MAINTENANCE): show a notice and no free slots */
  closed?: boolean
  /** Bangkok date to open on, e.g. the date picked in the rooms filter */
  focusDate?: string
}

export default function RoomSchedule({ roomId, closed = false, focusDate }: RoomScheduleProps) {
  const today = bkkToday()
  const thisWeek = startOfWeek(today)
  const nextWeek = addDays(thisWeek, 7)
  const [weekOffset, setWeekOffset] = useState<0 | 1>(focusDate && focusDate >= nextWeek ? 1 : 0)
  const days = useMemo(() => weekDays(addDays(thisWeek, weekOffset * 7)), [thisWeek, weekOffset])
  const [pickedDay, setPickedDay] = useState(focusDate ?? today)
  // Switching weeks falls back to today (this week) or Monday (next week)
  const selectedDay = days.includes(pickedDay) ? pickedDay : days.includes(today) ? today : days[1]

  // This week + next week in one request (14 days, within the API's 31-day limit)
  const { data, error, loading, reload } = useAsync(`${roomId}|${thisWeek}`, () =>
    getRoomBookings(roomId, thisWeek, addDays(thisWeek, 13)),
  )
  const bookings = useMemo(() => data ?? [], [data])
  const now = useNowMinutes()

  const blocksByDay = useMemo(() => {
    const map = new Map<string, DayBlock[]>()
    for (const day of days) map.set(day, blocksForDay(bookings, day))
    return map
  }, [bookings, days])

  // Widen the visible range if any booking this week starts earlier or ends later
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

  const lastBookable = addDays(today, BOOKABLE_DAYS)
  const weekIsEmpty = [...blocksByDay.values()].every((b) => b.length === 0)

  return (
    <section className="room-schedule" style={styles.section}>
      <div className="room-schedule-head" style={styles.head}>
        <h2 style={styles.heading}>ตารางการใช้ห้อง</h2>
        <div style={styles.nav}>
          {weekOffset === 1 && (
            <button style={styles.todayBtn} onClick={() => setWeekOffset(0)}>
              สัปดาห์นี้
            </button>
          )}
          <button
            style={navBtn(weekOffset === 0)}
            disabled={weekOffset === 0}
            onClick={() => setWeekOffset(0)}
            aria-label="สัปดาห์ก่อนหน้า"
          >
            ‹
          </button>
          <span style={styles.range}>{weekRangeLabel(days[0], days[6])}</span>
          <button
            style={navBtn(weekOffset === 1)}
            disabled={weekOffset === 1}
            onClick={() => setWeekOffset(1)}
            aria-label="สัปดาห์ถัดไป"
          >
            ›
          </button>
        </div>
      </div>

      {closed && <p style={styles.notice}>ห้องนี้ปิดปรับปรุง ยังไม่เปิดให้จองในช่วงนี้</p>}

      {error ? (
        <div style={styles.error}>
          <span>โหลดตารางไม่สำเร็จ: {error}</span>
          <button style={styles.todayBtn} onClick={reload}>
            ลองใหม่
          </button>
        </div>
      ) : loading ? (
        <div style={styles.skeleton} />
      ) : (
        <>
          <WeekGrid
            days={days}
            blocksByDay={blocksByDay}
            today={today}
            lastBookable={lastBookable}
            now={now}
            open={open}
            close={close}
          />
          <DayAgenda
            days={days}
            blocksByDay={blocksByDay}
            today={today}
            now={now}
            selected={selectedDay}
            onSelect={setPickedDay}
            open={open}
            close={close}
            maintenance={closed}
          />
          {weekIsEmpty && !closed && <p style={styles.empty}>ห้องนี้ว่างทั้งสัปดาห์</p>}
        </>
      )}

      <div style={styles.legend}>
        <span style={styles.legendItem}>
          <i style={{ ...styles.swatch, ...blockStyle('APPROVED') }} /> จองแล้ว
        </span>
        <span style={styles.legendItem}>
          <i style={{ ...styles.swatch, ...blockStyle('PENDING') }} /> รออนุมัติ (จองไม่ได้)
        </span>
        <span style={styles.legendItem}>
          <i style={{ ...styles.swatch, background: PAST_BG, border: '1px solid #e2e2e2' }} /> ผ่านไปแล้ว
        </span>
      </div>
    </section>
  )
}

/* ---------- desktop: week time-grid ---------- */

interface WeekGridProps {
  days: string[]
  blocksByDay: Map<string, DayBlock[]>
  today: string
  lastBookable: string
  now: number
  open: number
  close: number
}

function WeekGrid({ days, blocksByDay, today, lastBookable, now, open, close }: WeekGridProps) {
  const height = ((close - open) / 60) * HOUR_PX
  const hours = Array.from({ length: (close - open) / 60 + 1 }, (_, i) => open + i * 60)

  return (
    <div className="room-schedule-grid" style={styles.grid}>
      <div />
      {days.map((day) => {
        const isToday = day === today
        const weekend = weekdayOf(day) === 0 || weekdayOf(day) === 6
        return (
          <div key={day} style={styles.dayHead}>
            <span style={{ ...styles.dayName, color: weekend ? '#9a9a9a' : '#6b6b6b' }}>{weekdayLabel(day)}</span>
            <span style={isToday ? styles.dayNumToday : styles.dayNum}>{dayNumber(day)}</span>
            {day > lastBookable && <span style={styles.dayHint}>ยังไม่เปิดจอง</span>}
          </div>
        )
      })}

      <div style={{ position: 'relative', height }}>
        {hours.map((m) => (
          <span key={m} style={{ ...styles.hourLabel, top: ((m - open) / 60) * HOUR_PX }}>
            {formatMinutes(m)}
          </span>
        ))}
      </div>

      {days.map((day) => {
        const isPast = day < today
        const weekend = weekdayOf(day) === 0 || weekdayOf(day) === 6
        return (
          <div key={day} style={dayColumn(height, isPast, weekend)}>
            {day === today && now > open && now < close && (
              <div style={{ ...styles.nowLine, top: ((now - open) / 60) * HOUR_PX }} />
            )}
            {(blocksByDay.get(day) ?? []).map((block) => {
              const s = Math.max(block.startMin, open)
              const e = Math.min(block.endMin, close)
              const faded = isPast || (day === today && block.endMin <= now)
              return (
                <div
                  key={block.booking.id}
                  title={`${blockLabel(block.booking)} ${formatMinutes(block.startMin)}–${formatMinutes(block.endMin)}`}
                  style={{
                    ...styles.block,
                    ...blockStyle(block.booking.status),
                    top: ((s - open) / 60) * HOUR_PX,
                    height: Math.max(((e - s) / 60) * HOUR_PX - 2, 14),
                    left: `calc(${(block.lane / block.lanes) * 100}% + 3px)`,
                    width: `calc(${100 / block.lanes}% - 6px)`,
                    opacity: faded ? 0.45 : 1,
                  }}
                >
                  <span style={styles.blockTitle}>{blockLabel(block.booking)}</span>
                  <span style={styles.blockTime}>
                    {formatMinutes(block.startMin)}–{formatMinutes(block.endMin)}
                  </span>
                  {block.booking.status === 'PENDING' && <span style={styles.blockTime}>รออนุมัติ</span>}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/* ---------- mobile: day chips + agenda ---------- */

interface DayAgendaProps {
  days: string[]
  blocksByDay: Map<string, DayBlock[]>
  today: string
  now: number
  selected: string
  onSelect: (day: string) => void
  open: number
  close: number
  maintenance: boolean
}

function DayAgenda({ days, blocksByDay, today, now, selected, onSelect, open, close, maintenance }: DayAgendaProps) {
  const blocks = blocksByDay.get(selected) ?? []
  const isPast = selected < today
  // On today, free time that already passed is not offered
  const freeFrom = selected === today ? Math.max(open, Math.ceil(now / 30) * 30) : open
  const items = [
    ...blocks.map((b) => ({ start: b.startMin, end: b.endMin, block: b })),
    ...(isPast || maintenance ? [] : freeSlots(blocks, freeFrom, close).map(([start, end]) => ({ start, end, block: null }))),
  ].sort((a, b) => a.start - b.start)

  return (
    <div className="room-schedule-agenda">
      <div style={styles.chips}>
        {days.map((day) => {
          const active = day === selected
          const busy = (blocksByDay.get(day) ?? []).length
          return (
            <button key={day} onClick={() => onSelect(day)} style={chipStyle(active, day < today)}>
              <span style={{ fontSize: 12 }}>{weekdayLabel(day)}</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{dayNumber(day)}</span>
              <span style={{ ...styles.chipDot, opacity: busy ? 1 : 0, background: active ? '#fff' : '#1a1a1a' }} />
            </button>
          )
        })}
      </div>

      {isPast && <p style={styles.agendaNote}>วันนี้ผ่านไปแล้ว</p>}
      {items.length === 0 && !isPast && <p style={styles.agendaNote}>ไม่มีช่วงเวลาให้จองแล้ววันนี้</p>}
      <ul style={styles.agendaList}>
        {items.map(({ start, end, block }) => (
          <li key={`${start}-${block?.booking.id ?? 'free'}`} style={styles.agendaRow}>
            <span style={styles.agendaTime}>
              {formatMinutes(start)}–{formatMinutes(end)}
            </span>
            {block ? (
              <span style={{ ...styles.agendaTag, ...blockStyle(block.booking.status) }}>
                {blockLabel(block.booking)}
                {block.booking.status === 'PENDING' ? ' · รออนุมัติ' : ''}
              </span>
            ) : (
              <span style={styles.agendaFree}>ว่าง</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- data ---------- */

function useNowMinutes() {
  const [now, setNow] = useState(nowMinutes)
  useEffect(() => {
    const id = setInterval(() => setNow(nowMinutes()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Free [start, end) minute ranges between `open` and `close` */
function freeSlots(blocks: DayBlock[], open: number, close: number): [number, number][] {
  const free: [number, number][] = []
  let cursor = open
  for (const b of [...blocks].sort((x, y) => x.startMin - y.startMin)) {
    if (b.startMin > cursor) free.push([cursor, Math.min(b.startMin, close)])
    cursor = Math.max(cursor, b.endMin)
  }
  if (cursor < close) free.push([cursor, close])
  return free.filter(([s, e]) => e > s)
}

/* ---------- styles ---------- */

const PAST_BG = 'repeating-linear-gradient(135deg, #f3f3f3 0 6px, #ffffff 6px 12px)'

function blockStyle(status: string): CSSProperties {
  return status === 'PENDING'
    ? { background: '#FFF7ED', color: '#92400E', border: '1.5px dashed #F59E0B' }
    : { background: '#1a1a1a', color: '#ffffff', border: '1.5px solid #1a1a1a' }
}

function dayColumn(height: number, past: boolean, weekend: boolean): CSSProperties {
  const hourLines = `linear-gradient(to bottom, #ececec 1px, transparent 1px) 0 0 / 100% ${HOUR_PX}px`
  const base = past ? PAST_BG : weekend ? '#fafafa' : '#ffffff'
  return {
    position: 'relative',
    height,
    background: `${hourLines}, ${base}`,
    borderLeft: '1px solid #ececec',
  }
}

function navBtn(disabled: boolean): CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: '1.5px solid #1a1a1a',
    background: '#ffffff',
    fontSize: 20,
    lineHeight: 1,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    fontFamily: 'inherit',
  }
}

function chipStyle(active: boolean, past: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    minWidth: 0,
    padding: '8px 0',
    borderRadius: 10,
    border: active ? '1.5px solid #1a1a1a' : '1.5px solid #e4e4e4',
    background: active ? '#1a1a1a' : '#ffffff',
    color: active ? '#ffffff' : past ? '#b0b0b0' : '#1a1a1a',
    fontFamily: 'inherit',
    cursor: 'pointer',
  }
}

const styles: Record<string, CSSProperties> = {
  section: {
    marginTop: 28,
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    padding: '26px 28px 24px',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 },
  heading: { margin: 0, fontSize: 19, fontWeight: 700, color: '#1a1a1a' },
  nav: { display: 'flex', alignItems: 'center', gap: 10 },
  range: { minWidth: 150, textAlign: 'center', fontSize: 15, fontWeight: 600, color: '#1a1a1a' },
  todayBtn: {
    height: 34,
    padding: '0 14px',
    borderRadius: 8,
    border: '1.5px solid #1a1a1a',
    background: '#ffffff',
    fontFamily: 'inherit',
    fontSize: 14,
    cursor: 'pointer',
  },
  notice: {
    margin: '0 0 16px',
    padding: '10px 14px',
    borderRadius: 8,
    background: '#FEF2F2',
    color: '#B91C1C',
    fontSize: 14,
  },
  error: { display: 'flex', alignItems: 'center', gap: 14, color: '#B91C1C', fontSize: 14, padding: '24px 0' },
  skeleton: { height: 320, borderRadius: 10, background: '#EDEDED' },
  empty: { margin: '12px 0 0', fontSize: 14, color: '#6b6b6b' },
  grid: { display: 'grid', gridTemplateColumns: '52px repeat(7, minmax(0, 1fr))', rowGap: 8 },
  dayHead: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingBottom: 4 },
  dayName: { fontSize: 13 },
  dayNum: { fontSize: 17, fontWeight: 600, color: '#1a1a1a', lineHeight: '28px' },
  dayNumToday: {
    fontSize: 15,
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
  dayHint: { fontSize: 10, color: '#9a9a9a' },
  hourLabel: { position: 'absolute', right: 8, transform: 'translateY(-50%)', fontSize: 11, color: '#9a9a9a' },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2, background: '#EF4444', zIndex: 2 },
  block: {
    position: 'absolute',
    boxSizing: 'border-box',
    borderRadius: 6,
    padding: '4px 6px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    zIndex: 1,
  },
  blockTitle: { fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' },
  blockTime: { fontSize: 11, opacity: 0.85 },
  legend: { display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 16, fontSize: 13, color: '#6b6b6b' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  swatch: { display: 'inline-block', width: 14, height: 14, borderRadius: 3, boxSizing: 'border-box' },
  chips: { display: 'flex', gap: 6, marginBottom: 14 },
  chipDot: { width: 5, height: 5, borderRadius: 999 },
  agendaNote: { margin: '0 0 10px', fontSize: 14, color: '#6b6b6b' },
  agendaList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  agendaRow: { display: 'flex', alignItems: 'center', gap: 12 },
  agendaTime: { width: 96, flex: 'none', fontSize: 14, fontWeight: 600, color: '#1a1a1a' },
  agendaTag: { flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
  agendaFree: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: 8,
    fontSize: 14,
    color: '#15803D',
    background: '#F0FDF4',
    border: '1.5px solid #BBF7D0',
    boxSizing: 'border-box',
  },
}
