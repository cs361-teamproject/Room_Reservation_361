import { useCallback, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import BookingDetailModal from '../../components/BookingDetailModal'
import StatusBadge from '../../components/StatusBadge'
import { secondaryBtn } from '../../components/buttons'
import MonthGrid from '../../components/calendar/MonthGrid'
import WeekTimeline from '../../components/calendar/WeekTimeline'
import { calendarChipStyle } from '../../components/calendar/chipStyle'
import { useAsync } from '../../hooks/useAsync'
import { toDecisionTarget, useBookingDecisions } from '../../hooks/useBookingDecisions'
import { getBookingsInRange, getManageBookings } from '../../services/admin'
import type { Booking, DayBlock, ManageBooking } from '../../types/booking'
import {
  addDays,
  addMonths,
  bkkToday,
  monthGrid,
  monthLabel,
  shortDateLabel,
  startOfWeek,
  timeRangeLabel,
  toYmd,
  weekDays,
  weekRangeLabel,
} from '../../utils/bkkDate'
import { blocksForDay } from '../../utils/scheduleLayout'
import { RequestCard } from './BookingRequestList'

type Mode = 'month' | 'week'
type SideTab = 'pending' | 'recent'

const RECENT_LIMIT = 10
// Below this width the side panel sits above the calendar (see .admin-cal-shell in index.css)
const STACKED_MAX_PX = 1100

interface Props {
  canDecide: boolean
  /** Bumped by the page's refresh button */
  refreshKey: number
}

/**
 * Staff calendar: incoming requests on the side, every room's PENDING + APPROVED bookings on a
 * month or week calendar. Picking a request jumps the calendar to its day and outlines it.
 */
export default function BookingCalendar({ canDecide, refreshKey }: Props) {
  const today = bkkToday()
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState(today)
  const [selectedDay, setSelectedDay] = useState<string | null>(today)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [sideTab, setSideTab] = useState<SideTab>('pending')
  const calendarRef = useRef<HTMLElement>(null)

  const days = useMemo(() => (mode === 'month' ? monthGrid(cursor) : weekDays(startOfWeek(cursor))), [mode, cursor])
  const from = days[0]
  const to = days[days.length - 1]

  const cal = useAsync(`cal|${from}|${to}|${refreshKey}`, () => getBookingsInRange(from, to, ['PENDING', 'APPROVED']))
  const bookings = cal.data ?? (cal.loading ? cal.previous : undefined)
  const pending = useAsync(`pending|${refreshKey}`, () => getManageBookings('PENDING', 50))
  const recent = useAsync(`recent|${sideTab}|${refreshKey}`, () =>
    sideTab === 'recent' ? getManageBookings('ALL', RECENT_LIMIT) : Promise.resolve<ManageBooking[]>([]),
  )

  const { reload: reloadCal } = cal
  const { reload: reloadPending } = pending
  const { reload: reloadRecent } = recent
  const reloadAll = useCallback(() => {
    reloadCal()
    reloadPending()
    reloadRecent()
  }, [reloadCal, reloadPending, reloadRecent])
  const decisions = useBookingDecisions(reloadAll)

  const blocksByDay = useMemo(() => {
    const map = new Map<string, DayBlock[]>()
    for (const day of days) map.set(day, blocksForDay(bookings ?? [], day))
    return map
  }, [bookings, days])
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>()
    for (const [day, blocks] of blocksByDay) map.set(day, blocks.map((b) => b.booking))
    return map
  }, [blocksByDay])

  const move = (step: 1 | -1) => setCursor((c) => (mode === 'month' ? addMonths(c, step) : addDays(c, step * 7)))
  const goToday = () => {
    setCursor(today)
    setSelectedDay(today)
  }
  const showWeekOf = (day: string) => {
    setMode('week')
    setCursor(day)
    setSelectedDay(day)
  }

  /** Side card picked: show its day on the calendar and outline its chip */
  const jumpTo = (b: ManageBooking) => {
    const day = toYmd(Date.parse(b.start_time))
    setCursor(day)
    setSelectedDay(day)
    setHighlightId(b.id)
    if (window.innerWidth <= STACKED_MAX_PX) calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sideItems = sideTab === 'pending' ? pending : recent
  const sideList = sideItems.data ?? (sideItems.loading ? sideItems.previous : undefined)
  const pendingCount = (pending.data ?? pending.previous)?.length
  const agenda = selectedDay && days.includes(selectedDay) ? (bookingsByDay.get(selectedDay) ?? []) : null

  return (
    <div className="admin-cal-shell" style={styles.shell}>
      {/* ---------- side: incoming requests ---------- */}
      <aside className="admin-cal-side" style={styles.panel}>
        <div style={styles.sideTabs} role="tablist">
          {(['pending', 'recent'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={sideTab === tab}
              onClick={() => setSideTab(tab)}
              style={{ ...styles.sideTab, ...(sideTab === tab ? styles.sideTabActive : null) }}
            >
              {tab === 'pending' ? 'รออนุมัติ' : 'ล่าสุด'}
              {tab === 'pending' && pendingCount ? <span style={styles.count}>{pendingCount}</span> : null}
            </button>
          ))}
        </div>
        <p style={styles.sideHint}>
          {sideTab === 'pending' ? 'คำขอใหม่อยู่บนสุด กดการ์ดเพื่อดูในปฏิทิน' : `${RECENT_LIMIT} รายการล่าสุดทุกสถานะ`}
        </p>

        {sideItems.error ? (
          <div style={styles.error}>
            <span>โหลดไม่สำเร็จ: {sideItems.error}</span>
            <button style={{ ...secondaryBtn, ...styles.smallBtn }} onClick={sideItems.reload}>
              ลองใหม่
            </button>
          </div>
        ) : !sideList ? (
          <div style={styles.sideList}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={styles.skeletonCard} />
            ))}
          </div>
        ) : sideList.length === 0 ? (
          <p style={styles.empty}>{sideTab === 'pending' ? 'ไม่มีคำขอที่รออนุมัติ' : 'ยังไม่มีการจอง'}</p>
        ) : (
          <ul className="admin-cal-side-list" style={{ ...styles.sideList, opacity: sideItems.loading ? 0.5 : 1 }}>
            {sideList.map((b) => (
              <RequestCard
                key={b.id}
                booking={b}
                compact
                highlighted={b.id === highlightId}
                canDecide={canDecide}
                busy={decisions.busyId === b.id}
                onOpen={() => jumpTo(b)}
                onApprove={() => decisions.approve(b)}
                onReject={() => decisions.reject(b)}
              />
            ))}
          </ul>
        )}
      </aside>

      {/* ---------- calendar ---------- */}
      <section ref={calendarRef} style={styles.panel}>
        <div className="admin-cal-toolbar" style={styles.toolbar}>
          <div style={styles.nav}>
            <button style={styles.navBtn} onClick={() => move(-1)} aria-label={mode === 'month' ? 'เดือนก่อน' : 'สัปดาห์ก่อน'}>
              ‹
            </button>
            <span style={styles.rangeLabel}>{mode === 'month' ? monthLabel(cursor) : weekRangeLabel(days[0], days[6])}</span>
            <button style={styles.navBtn} onClick={() => move(1)} aria-label={mode === 'month' ? 'เดือนถัดไป' : 'สัปดาห์ถัดไป'}>
              ›
            </button>
          </div>
          <div style={styles.nav}>
            <button style={styles.toolBtn} onClick={goToday}>
              วันนี้
            </button>
            <div style={styles.segment} role="group" aria-label="มุมมองปฏิทิน">
              {(['month', 'week'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  style={{ ...styles.segmentBtn, ...(mode === m ? styles.segmentActive : null) }}
                >
                  {m === 'month' ? 'เดือน' : 'สัปดาห์'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {cal.error ? (
          <div style={styles.error}>
            <span>โหลดปฏิทินไม่สำเร็จ: {cal.error}</span>
            <button style={{ ...secondaryBtn, ...styles.smallBtn }} onClick={cal.reload}>
              ลองใหม่
            </button>
          </div>
        ) : !bookings ? (
          <div style={styles.skeletonCal} />
        ) : (
          <div style={{ opacity: cal.loading ? 0.5 : 1, transition: 'opacity 120ms' }}>
            {mode === 'month' ? (
              <MonthGrid
                days={days}
                month={addMonths(cursor, 0).slice(0, 7)}
                bookingsByDay={bookingsByDay}
                today={today}
                selectedDay={selectedDay}
                highlightId={highlightId}
                onSelect={setDetailId}
                onPickDay={setSelectedDay}
                onMore={showWeekOf}
              />
            ) : (
              <WeekTimeline
                days={days}
                blocksByDay={blocksByDay}
                today={today}
                selectedDay={selectedDay}
                highlightId={highlightId}
                onSelect={setDetailId}
                onPickDay={setSelectedDay}
              />
            )}
          </div>
        )}

        <div style={styles.legend}>
          <span style={styles.legendItem}>
            <i style={{ ...styles.swatch, ...calendarChipStyle('PENDING') }} /> รออนุมัติ
          </span>
          <span style={styles.legendItem}>
            <i style={{ ...styles.swatch, ...calendarChipStyle('APPROVED') }} /> อนุมัติแล้ว
          </span>
          <span style={styles.legendItem}>
            <i style={{ ...styles.swatch, borderRadius: 999, background: '#F59E0B', border: 'none', width: 8, height: 8 }} />
            วันที่มีคำขอรออนุมัติ
          </span>
        </div>

        {/* ---------- the picked day's bookings (the only detail phones get in month view) ---------- */}
        {agenda && selectedDay && (
          <div style={styles.agenda}>
            <h3 style={styles.agendaHead}>
              {shortDateLabel(selectedDay)} · {agenda.length ? `${agenda.length} รายการ` : 'ไม่มีการจอง'}
            </h3>
            <ul style={styles.agendaList}>
              {agenda.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setDetailId(b.id)}
                    style={{ ...styles.agendaRow, ...(b.id === highlightId ? styles.agendaRowHighlighted : null) }}
                  >
                    <span style={styles.agendaTime}>{timeRangeLabel(b.start_time, b.end_time)}</span>
                    <span style={styles.agendaRoom}>
                      <b>{b.room.room_name}</b>
                      {b.title && <span style={styles.agendaTitle}> · {b.title}</span>}
                    </span>
                    <StatusBadge status={b.status} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {detailId && (
        <BookingDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          {...(canDecide && {
            deciding: decisions.busyId === detailId,
            onApprove: async (b) => {
              if (await decisions.approve(toDecisionTarget(b))) setDetailId(null)
            },
            onReject: (b) => {
              setDetailId(null)
              decisions.reject(toDecisionTarget(b))
            },
          })}
        />
      )}
      {decisions.ui}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  shell: { display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 20, alignItems: 'start' },
  panel: {
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    padding: 18,
    minWidth: 0,
    scrollMarginTop: 16,
  },
  sideTabs: { display: 'flex', gap: 6, padding: 4, borderRadius: 10, background: '#F3F4F6' },
  sideTab: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#4b4b4b',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  sideTabActive: { background: '#ffffff', color: '#1a1a1a', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' },
  count: {
    minWidth: 20,
    height: 20,
    padding: '0 6px',
    borderRadius: 999,
    background: '#F59E0B',
    color: '#ffffff',
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
  },
  sideHint: { margin: '10px 2px 12px', fontSize: 12, color: '#9a9a9a' },
  sideList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxHeight: 'calc(100vh - 230px)',
    overflowY: 'auto',
  },
  skeletonCard: { height: 120, borderRadius: 12, background: '#EDEDED' },
  empty: { margin: '18px 0', textAlign: 'center', fontSize: 14, color: '#6b6b6b' },
  error: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, color: '#B91C1C', fontSize: 14, padding: '16px 0' },
  smallBtn: { height: 34, padding: '0 14px', fontSize: 14 },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  nav: { display: 'flex', alignItems: 'center', gap: 8 },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: '1.5px solid #1a1a1a',
    background: '#ffffff',
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  rangeLabel: { minWidth: 150, textAlign: 'center', fontSize: 16, fontWeight: 700 },
  toolBtn: {
    height: 34,
    padding: '0 14px',
    borderRadius: 8,
    border: '1.5px solid #1a1a1a',
    background: '#ffffff',
    fontFamily: 'inherit',
    fontSize: 14,
    cursor: 'pointer',
  },
  segment: { display: 'flex', padding: 3, borderRadius: 9, background: '#F3F4F6' },
  segmentBtn: {
    height: 28,
    padding: '0 12px',
    border: 'none',
    borderRadius: 7,
    background: 'transparent',
    color: '#4b4b4b',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  segmentActive: { background: '#1a1a1a', color: '#ffffff' },
  skeletonCal: { height: 520, borderRadius: 12, background: '#EDEDED' },
  legend: { display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14, fontSize: 13, color: '#6b6b6b' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  swatch: { display: 'inline-block', width: 14, height: 14, borderRadius: 3, boxSizing: 'border-box' },
  agenda: { marginTop: 18, paddingTop: 16, borderTop: '1px solid #ECECEC' },
  agendaHead: { margin: '0 0 10px', fontSize: 15, fontWeight: 700 },
  agendaList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  agendaRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 10px',
    border: '1.5px solid #ECECEC',
    borderRadius: 10,
    background: '#ffffff',
    fontFamily: 'inherit',
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer',
  },
  agendaRowHighlighted: { borderColor: '#2563EB' },
  agendaTime: { width: 96, flex: 'none', fontWeight: 600 },
  agendaRoom: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  agendaTitle: { color: '#6b6b6b' },
}
