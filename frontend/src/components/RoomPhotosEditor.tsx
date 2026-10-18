import { useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { ApiError } from '../services/api'
import { deleteRoomPhoto, reorderRoomPhotos, uploadRoomPhoto } from '../services/admin'
import type { RoomPhoto } from '../types/admin'
import { PHOTO_MAX_BYTES, PHOTO_MAX_COUNT, PHOTO_TYPES } from '../utils/roomPhotos'

interface Props {
  roomId: string
  initial: RoomPhoto[]
}

/** Photos of a saved room. Each action is saved at once (its own endpoint), not with the form. */
export default function RoomPhotosEditor({ roomId, initial }: Props) {
  const [photos, setPhotos] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const run = async (label: string, action: () => Promise<RoomPhoto[]>) => {
    setBusy(label)
    setError(null)
    try {
      setPhotos(await action())
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'บันทึกรูปไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setBusy(null)
    }
  }

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow picking the same file again
    // Check in the browser first so a bad file never starts an upload
    const bad = files.find((f) => !PHOTO_TYPES.includes(f.type) || f.size > PHOTO_MAX_BYTES)
    if (bad) return setError(`${bad.name}: รองรับเฉพาะ JPG, PNG, WebP ขนาดไม่เกิน 5 MB`)
    if (photos.length + files.length > PHOTO_MAX_COUNT) return setError(`ห้องหนึ่งมีรูปได้ไม่เกิน ${PHOTO_MAX_COUNT} รูป`)
    for (const [i, file] of files.entries()) {
      await run(`กำลังอัปโหลด ${i + 1}/${files.length}…`, () => uploadRoomPhoto(roomId, file))
    }
  }

  const move = (index: number, by: -1 | 1) => {
    const ids = photos.map((p) => p.id)
    ;[ids[index], ids[index + by]] = [ids[index + by], ids[index]]
    run('กำลังบันทึกลำดับ…', () => reorderRoomPhotos(roomId, ids))
  }

  const full = photos.length >= PHOTO_MAX_COUNT

  return (
    <div style={styles.wrap}>
      <div className="room-photos-grid" style={{ ...styles.grid, opacity: busy ? 0.6 : 1 }}>
        {photos.map((p, i) => (
          <figure key={p.id} style={styles.tile}>
            <img src={p.url} alt={`รูปที่ ${i + 1}`} style={styles.img} />
            {i === 0 && <span style={styles.cover}>รูปหลัก</span>}
            <button
              type="button"
              style={{ ...styles.iconBtn, top: 6, right: 6 }}
              disabled={Boolean(busy)}
              onClick={() => run('กำลังลบ…', () => deleteRoomPhoto(roomId, p.id))}
              aria-label={`ลบรูปที่ ${i + 1}`}
            >
              ✕
            </button>
            <span style={styles.moves}>
              <button
                type="button"
                style={{ ...styles.iconBtn, position: 'static', ...(i === 0 ? styles.hidden : null) }}
                disabled={Boolean(busy) || i === 0}
                onClick={() => move(i, -1)}
                aria-label={`เลื่อนรูปที่ ${i + 1} ไปทางซ้าย`}
              >
                ‹
              </button>
              <button
                type="button"
                style={{ ...styles.iconBtn, position: 'static', ...(i === photos.length - 1 ? styles.hidden : null) }}
                disabled={Boolean(busy) || i === photos.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`เลื่อนรูปที่ ${i + 1} ไปทางขวา`}
              >
                ›
              </button>
            </span>
          </figure>
        ))}
        {!full && (
          <button type="button" style={styles.add} disabled={Boolean(busy)} onClick={() => input.current?.click()}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>+</span>
            <span>เพิ่มรูป</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={PHOTO_TYPES.join(',')} multiple hidden onChange={onFiles} />
      <span style={styles.hint}>
        {busy ?? `JPG, PNG หรือ WebP ไม่เกิน 5 MB · สูงสุด ${PHOTO_MAX_COUNT} รูป · การเปลี่ยนรูปบันทึกทันที`}
      </span>
      {error && (
        <span role="alert" style={styles.error}>
          {error}
        </span>
      )}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 },
  tile: { position: 'relative', margin: 0, aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden', background: '#EDEDED' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  cover: {
    position: 'absolute',
    left: 6,
    top: 6,
    padding: '2px 8px',
    borderRadius: 999,
    background: '#1a1a1a',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 700,
  },
  iconBtn: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 999,
    border: 'none',
    background: 'rgba(255,255,255,0.92)',
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
  },
  hidden: { visibility: 'hidden' },
  moves: { position: 'absolute', left: 6, right: 6, bottom: 6, display: 'flex', justifyContent: 'space-between' },
  add: {
    aspectRatio: '4 / 3',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    border: '1.5px dashed #C4C4C4',
    background: '#ffffff',
    color: '#4b4b4b',
    fontFamily: 'inherit',
    fontSize: 14,
    cursor: 'pointer',
  },
  hint: { fontSize: 13, color: '#9a9a9a' },
  error: { fontSize: 13, color: '#B91C1C' },
}
