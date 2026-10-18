import { useState } from 'react'
import type { CSSProperties } from 'react'
import { secondaryBtn } from '../../components/buttons'
import { useAsync } from '../../hooks/useAsync'
import { getWeeklyStats } from '../../services/admin'
import type { WeeklyStats } from '../../types/booking'
import { addDays, bkkToday, weekdayOf, weekRangeLabel } from '../../utils/bkkDate'

// How far back the week picker goes
const MAX_WEEKS_BACK = 12
// One hue for magnitude (bars are a single series); the top room is called out by a label, not a color
const BAR = '#3F3F46'
const TRACK = '#F0F0F0'

// The stats API weeks run Monday–Sunday (weekdayOf: Sunday = 0)
const mondayOf = (ymd: string) => addDays(ymd, -((weekdayOf(ymd) + 6) % 7))

export default function AdminStats() {
  const thisMonday = mondayOf(bkkToday())
  const [weeksBack, setWeeksBack] = useState(0)
  const monday = addDays(thisMonday, -7 * weeksBack)

  const { data, previous, error, loading, reload } = useAsync(monday, async () => {
    const [current, before] = await Promise.all([getWeeklyStats(monday), getWeeklyStats(addDays(monday, -7))])
    return { current, before }
  })
  const shown = data ?? (loading ? previous : undefined)

  return (
    <div>
      <div className="admin-head" style={styles.headRow}>
        <h1 style={styles.heading}>สถิติการใช้ห้อง</h1>
        <div style={styles.nav}>
          {weeksBack > 0 && (
            <button style={{ ...secondaryBtn, ...styles.navToday }} onClick={() => setWeeksBack(0)}>
              สัปดาห์นี้
            </button>
          )}
          <button
            style={navBtn(weeksBack >= MAX_WEEKS_BACK)}
            disabled={weeksBack >= MAX_WEEKS_BACK}
            onClick={() => setWeeksBack((w) => w + 1)}
            aria-label="สัปดาห์ก่อนหน้า"
          >
            ‹
          </button>
          <span style={styles.range}>
            {weekRangeLabel(monday, addDays(monday, 6))} {Number(monday.slice(0, 4)) + 543}
          </span>
          <button
            style={navBtn(weeksBack === 0)}
            disabled={weeksBack === 0}
            onClick={() => setWeeksBack((w) => w - 1)}
            aria-label="สัปดาห์ถัดไป"
          >
            ›
          </button>
        </div>
      </div>

      {error ? (
        <div style={styles.error}>
          <span>โหลดสถิติไม่สำเร็จ: {error}</span>
          <button style={secondaryBtn} onClick={reload}>
            ลองใหม่
          </button>
        </div>
      ) : !shown ? (
        <>
          <div className="admin-stat-tiles" style={styles.tiles}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...styles.tile, height: 104, background: '#EDEDED', boxShadow: 'none' }} />
            ))}
          </div>
          <div style={{ ...styles.card, height: 320, background: '#EDEDED', boxShadow: 'none' }} />
        </>
      ) : (
        <div style={{ opacity: loading ? 0.5 : 1 }}>
          <Tiles current={shown.current} before={shown.before} />
          <RoomBars stats={shown.current} />
        </div>
      )}
      <p style={styles.footnote}>นับเฉพาะการจองที่อนุมัติแล้ว · สัปดาห์เริ่มวันจันทร์ถึงวันอาทิตย์</p>
    </div>
  )
}

function Tiles({ current, before }: { current: WeeklyStats; before: WeeklyStats }) {
  const top = current.rooms[0]
  return (
    <div className="admin-stat-tiles" style={styles.tiles}>
      <Tile label="การจองที่อนุมัติ" value={`${current.total_bookings} ครั้ง`} delta={change(current.total_bookings, before.total_bookings)} />
      <Tile label="ชั่วโมงการใช้ห้อง" value={`${current.total_hours} ชม.`} delta={change(current.total_hours, before.total_hours)} />
      <Tile
        label="ห้องที่ใช้มากที่สุด"
        value={current.top_room ?? '–'}
        sub={top ? `${top.hours} ชม. · ${top.bookings} ครั้ง` : 'ยังไม่มีการใช้ห้อง'}
      />
    </div>
  )
}

/** Percent change vs last week, or null when last week had nothing to compare */
const change = (now: number, before: number) => (before === 0 ? null : Math.round(((now - before) / before) * 100))

function Tile({ label, value, delta, sub }: { label: string; value: string; delta?: number | null; sub?: string }) {
  return (
    <div style={styles.tile}>
      <span style={styles.tileLabel}>{label}</span>
      <span style={styles.tileValue}>{value}</span>
      {delta !== undefined && (
        <span style={{ ...styles.tileSub, color: delta == null || delta === 0 ? '#6b6b6b' : delta > 0 ? '#15803D' : '#B91C1C' }}>
          {delta == null ? 'ไม่มีข้อมูลสัปดาห์ก่อน' : `${delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} ${Math.abs(delta)}% จากสัปดาห์ก่อน`}
        </span>
      )}
      {sub && <span style={styles.tileSub}>{sub}</span>}
    </div>
  )
}

/** Hours per room as a horizontal bar list; every value is printed, the tooltip adds the share */
function RoomBars({ stats }: { stats: WeeklyStats }) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...stats.rooms.map((r) => r.hours))

  return (
    <section style={styles.card}>
      <h2 style={styles.subhead}>ชั่วโมงการใช้ต่อห้อง</h2>
      {stats.rooms.length === 0 ? (
        <p style={styles.empty}>สัปดาห์นี้ยังไม่มีการจองที่อนุมัติ</p>
      ) : (
        <ul style={styles.bars}>
          {stats.rooms.map((r, i) => {
            const share = stats.total_hours ? Math.round((r.hours / stats.total_hours) * 100) : 0
            return (
              <li
                key={r.room_name}
                className="admin-stat-row"
                style={{ ...styles.barRow, background: hover === r.room_name ? '#FAFAFA' : 'transparent' }}
                onMouseEnter={() => setHover(r.room_name)}
                onMouseLeave={() => setHover(null)}
              >
                <span style={styles.barName}>
                  {r.room_name}
                  {i === 0 && <span style={styles.topTag}>อันดับ 1</span>}
                </span>
                <span style={styles.track}>
                  <span style={{ ...styles.bar, width: `${(r.hours / max) * 100}%` }} />
                  {hover === r.room_name && (
                    <span role="tooltip" style={styles.tooltip}>
                      {r.room_name}: {r.hours} ชม. จาก {r.bookings} ครั้ง ({share}% ของทั้งหมด)
                    </span>
                  )}
                </span>
                <span style={styles.barValue}>
                  <b>{r.hours} ชม.</b> · {r.bookings} ครั้ง
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
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

const styles: Record<string, CSSProperties> = {
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  heading: { margin: 0, fontSize: 26, fontWeight: 600 },
  nav: { display: 'flex', alignItems: 'center', gap: 10 },
  navToday: { height: 34, padding: '0 14px', fontSize: 14 },
  range: { minWidth: 170, textAlign: 'center', fontSize: 15, fontWeight: 600 },
  error: { display: 'flex', alignItems: 'center', gap: 14, color: '#B91C1C', fontSize: 14, padding: '24px 0' },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 20 },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '18px 22px',
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
  },
  tileLabel: { fontSize: 14, color: '#6b6b6b' },
  tileValue: { fontSize: 28, fontWeight: 600, lineHeight: 1.2 },
  tileSub: { fontSize: 13, color: '#6b6b6b' },
  card: { background: '#ffffff', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '22px 24px' },
  subhead: { margin: '0 0 14px', fontSize: 19, fontWeight: 700 },
  empty: { margin: 0, fontSize: 14, color: '#6b6b6b' },
  bars: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  barRow: {
    display: 'grid',
    gridTemplateColumns: '170px minmax(0, 1fr) 140px',
    alignItems: 'center',
    gap: 14,
    padding: '10px 8px',
    borderRadius: 8,
  },
  barName: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, minWidth: 0 },
  topTag: {
    padding: '2px 8px',
    borderRadius: 999,
    border: '1.5px dashed #F59E0B',
    background: '#FFF7ED',
    color: '#92400E',
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  track: { position: 'relative', height: 14, borderRadius: 4, background: TRACK },
  bar: { display: 'block', height: '100%', minWidth: 4, borderRadius: '0 4px 4px 0', background: BAR },
  tooltip: {
    position: 'absolute',
    left: 0,
    bottom: 22,
    zIndex: 2,
    padding: '6px 10px',
    borderRadius: 8,
    background: '#1a1a1a',
    color: '#ffffff',
    fontSize: 13,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  barValue: { fontSize: 14, color: '#4b4b4b', textAlign: 'right', whiteSpace: 'nowrap' },
  footnote: { margin: '14px 0 0', fontSize: 13, color: '#9a9a9a' },
}
