import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import logo from '../assets/logo.png'
import { useAuth } from '../auth/context'
import PasswordInput from '../components/PasswordInput'
import { disabledBtn, primaryBtn } from '../components/buttons'
import { authConfigured } from '../config/amplify'

interface LoginValues {
  username: string
  password: string
}

interface NewPasswordValues {
  password: string
  confirm: string
}

/** Same rule as the user pool (Cognito default policy) */
const PASSWORD_RULE = 'อย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก ตัวเลข และอักขระพิเศษ'
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

/** Cognito error names → messages that do not reveal whether the account exists */
function loginMessage(e: unknown): string {
  // The screen stays vague on purpose; the console says what Cognito really answered
  if (import.meta.env.DEV) console.warn('Login failed:', e)
  const name = e instanceof Error ? e.name : ''
  if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') return 'รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง'
  if (name === 'InvalidPasswordException') return `รหัสผ่านใหม่ไม่ตรงตามเงื่อนไข: ${PASSWORD_RULE}`
  if (name === 'LimitExceededException' || name === 'TooManyRequestsException') return 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่'
  if (name === 'NetworkError' || name === 'TypeError') return 'เชื่อมต่อระบบ login ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต'
  return e instanceof Error && e.message ? e.message : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่'
}

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { status, user, error: authError, login, setNewPassword } = useAuth()
  const [step, setStep] = useState<'login' | 'new-password'>('login')
  const [error, setError] = useState<string | null>(null)
  // Only same-site paths, so ?next= cannot send people to another website
  const next = params.get('next')?.startsWith('/') && !params.get('next')?.startsWith('//') ? params.get('next')! : '/'

  const loginForm = useForm<LoginValues>()
  const passwordForm = useForm<NewPasswordValues>()

  useEffect(() => {
    if (user) navigate(next, { replace: true })
  }, [user, next, navigate])

  const submitLogin = loginForm.handleSubmit(async ({ username, password }) => {
    setError(null)
    try {
      if ((await login(username, password)) === 'new-password') setStep('new-password')
    } catch (e) {
      setError(loginMessage(e))
    }
  })

  const submitNewPassword = passwordForm.handleSubmit(async ({ password }) => {
    setError(null)
    try {
      await setNewPassword(password)
    } catch (e) {
      setError(loginMessage(e))
    }
  })

  const busy = loginForm.formState.isSubmitting || passwordForm.formState.isSubmitting || status === 'loading'
  const message = error ?? authError

  return (
    <main className="login-page" style={styles.main}>
      <div className="login-card" style={styles.card}>
        <img src={logo} alt="Computer Science, Thammasat University" style={styles.logo} />

        {step === 'login' ? (
          <form onSubmit={submitLogin} style={styles.form} noValidate>
            <div>
              <h1 style={styles.title}>เข้าสู่ระบบ</h1>
              <p style={styles.subtitle}>ใช้รหัสประจำตัว (หรืออีเมล) และรหัสผ่านของระบบจองห้อง</p>
            </div>
            <label style={styles.field}>
              <span style={styles.label}>รหัสประจำตัว หรืออีเมล</span>
              <input
                {...loginForm.register('username', { required: 'กรุณาใส่รหัสประจำตัว' })}
                autoComplete="username"
                autoFocus
                placeholder="เช่น 6709616541"
                style={styles.input}
              />
              {loginForm.formState.errors.username && <span style={styles.fieldError}>{loginForm.formState.errors.username.message}</span>}
            </label>
            <label style={styles.field}>
              <span style={styles.label}>รหัสผ่าน</span>
              <PasswordInput
                {...loginForm.register('password', { required: 'กรุณาใส่รหัสผ่าน' })}
                autoComplete="current-password"
                style={styles.input}
              />
              {loginForm.formState.errors.password && <span style={styles.fieldError}>{loginForm.formState.errors.password.message}</span>}
            </label>
            {message && (
              <p role="alert" style={styles.error}>
                {message}
              </p>
            )}
            {!authConfigured && <p style={styles.error}>ยังไม่ได้ตั้งค่า Cognito (VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_CLIENT_ID)</p>}
            <button type="submit" style={{ ...primaryBtn, ...styles.submit, ...(busy || !authConfigured ? disabledBtn : null) }} disabled={busy || !authConfigured}>
              {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitNewPassword} style={styles.form} noValidate>
            <div>
              <h1 style={styles.title}>ตั้งรหัสผ่านใหม่</h1>
              <p style={styles.subtitle}>เข้าสู่ระบบครั้งแรก กรุณาตั้งรหัสผ่านใหม่แทนรหัสชั่วคราว</p>
            </div>
            <label style={styles.field}>
              <span style={styles.label}>รหัสผ่านใหม่</span>
              <PasswordInput
                {...passwordForm.register('password', {
                  required: 'กรุณาใส่รหัสผ่านใหม่',
                  pattern: { value: STRONG_PASSWORD, message: PASSWORD_RULE },
                })}
                autoComplete="new-password"
                autoFocus
                style={styles.input}
              />
              <span style={passwordForm.formState.errors.password ? styles.fieldError : styles.hint}>
                {passwordForm.formState.errors.password?.message ?? PASSWORD_RULE}
              </span>
            </label>
            <label style={styles.field}>
              <span style={styles.label}>ยืนยันรหัสผ่านใหม่</span>
              <PasswordInput
                {...passwordForm.register('confirm', {
                  validate: (v, all) => v === all.password || 'รหัสผ่านทั้งสองช่องไม่ตรงกัน',
                })}
                autoComplete="new-password"
                style={styles.input}
              />
              {passwordForm.formState.errors.confirm && <span style={styles.fieldError}>{passwordForm.formState.errors.confirm.message}</span>}
            </label>
            {message && (
              <p role="alert" style={styles.error}>
                {message}
              </p>
            )}
            <button type="submit" style={{ ...primaryBtn, ...styles.submit, ...(busy ? disabledBtn : null) }} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึกและเข้าสู่ระบบ'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  main: { display: 'flex', justifyContent: 'center', padding: '56px 24px 80px' },
  card: {
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    padding: '32px 32px 36px',
    background: '#ffffff',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
  },
  logo: { height: 52, width: 'auto', alignSelf: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  title: { margin: 0, fontSize: 24, fontWeight: 700 },
  subtitle: { margin: '6px 0 0', fontSize: 14, color: '#6b6b6b' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: '#6b6b6b' },
  input: {
    height: 44,
    padding: '0 14px',
    borderRadius: 10,
    border: '1px solid #E0E0E0',
    fontFamily: 'inherit',
    fontSize: 15,
    color: '#1a1a1a',
    outline: 'none',
  },
  hint: { fontSize: 12, color: '#9a9a9a' },
  fieldError: { fontSize: 13, color: '#B91C1C' },
  error: { margin: 0, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 14 },
  submit: { height: 44, marginTop: 4 },
}
