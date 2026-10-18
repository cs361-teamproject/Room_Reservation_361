import { useState } from 'react'
import type { CSSProperties, InputHTMLAttributes, Ref } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { ref?: Ref<HTMLInputElement> }

/** A password field with an eye button to show what was typed. Works with react-hook-form's register(). */
export default function PasswordInput({ style, ...props }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <span style={styles.wrap}>
      <input {...props} type={visible ? 'text' : 'password'} style={{ ...style, ...styles.input }} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={styles.toggle}
        aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        aria-pressed={visible}
        title={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  )
}

const styles: Record<string, CSSProperties> = {
  wrap: { position: 'relative', display: 'flex' },
  input: { flex: 1, minWidth: 0, paddingRight: 46 },
  toggle: {
    position: 'absolute',
    right: 6,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#6b6b6b',
    cursor: 'pointer',
  },
}
