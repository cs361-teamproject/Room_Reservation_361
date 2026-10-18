import type { CSSProperties } from 'react'

// Button looks shared by the booking screens; same palette as RoomSchedule / SearchFilter
const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  height: 40,
  padding: '0 18px',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: 15,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  boxSizing: 'border-box',
}

export const primaryBtn: CSSProperties = { ...base, background: '#1a1a1a', color: '#ffffff', border: '1.5px solid #1a1a1a' }
export const secondaryBtn: CSSProperties = { ...base, background: '#ffffff', color: '#1a1a1a', border: '1.5px solid #1a1a1a' }
export const dangerBtn: CSSProperties = { ...base, background: '#EF4444', color: '#ffffff', border: '1.5px solid #EF4444' }
export const ghostDangerBtn: CSSProperties = { ...base, background: '#ffffff', color: '#B91C1C', border: '1.5px solid #FECACA' }
export const disabledBtn: CSSProperties = { opacity: 0.4, cursor: 'not-allowed' }
