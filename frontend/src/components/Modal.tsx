import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Buttons row at the bottom */
  footer?: ReactNode
  width?: number
}

/** Centered card on desktop, bottom sheet on phones (.modal-card in index.css). Esc and the backdrop close it. */
export default function Modal({ title, onClose, children, footer, width = 560 }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" style={styles.backdrop} onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ ...styles.card, maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <h2 style={styles.title}>{title}</h2>
          <button onClick={onClose} style={styles.close} aria-label="ปิด">
            ✕
          </button>
        </div>
        <div style={styles.body}>{children}</div>
        {footer && (
          <div className="modal-footer" style={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'rgba(0,0,0,0.45)',
  },
  card: {
    width: '100%',
    maxHeight: 'calc(100vh - 48px)',
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
    fontFamily: "'IBM Plex Sans Thai', sans-serif",
    color: '#1a1a1a',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '22px 28px 0' },
  title: { margin: 0, fontSize: 19, fontWeight: 700 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: 'none',
    background: '#F3F3F3',
    fontSize: 14,
    cursor: 'pointer',
    flex: 'none',
  },
  body: { padding: '18px 28px', overflowY: 'auto' },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '14px 28px 22px',
    borderTop: '1px solid #F0F0F0',
  },
}
