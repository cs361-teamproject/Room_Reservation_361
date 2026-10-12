import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

/** One short message at the bottom of the screen; showing a new one replaces the old. */
export function useToast() {
  const [message, setMessage] = useState<ReactNode>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (message === null) return
    const id = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(id)
  }, [message, key])

  const show = useCallback((m: ReactNode) => {
    setMessage(m)
    setKey((k) => k + 1)
  }, [])

  const toast = message === null ? null : (
    <div role="status" style={style}>
      {message}
    </div>
  )
  return { toast, show }
}

const style: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 28,
  transform: 'translateX(-50%)',
  zIndex: 60,
  maxWidth: 'calc(100vw - 32px)',
  padding: '12px 20px',
  borderRadius: 10,
  background: '#1a1a1a',
  color: '#ffffff',
  fontSize: 15,
  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}
