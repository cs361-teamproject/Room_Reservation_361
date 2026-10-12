// Who is "logged in" while there is no real login (T3). A role switcher in the NavBar
// changes it, so every screen can be checked as every role. Remembered in localStorage.
import { useSyncExternalStore } from 'react'
import type { UserRole } from '../types/booking'

export interface MockUser {
  username: string
  role: UserRole
  display_name: string
}

// Same usernames as the backend seed / Cognito demo accounts
export const MOCK_USERS: Record<UserRole, MockUser> = {
  STUDENT: { username: '6709616541', role: 'STUDENT', display_name: 'นักศึกษา ทดสอบ 1' },
  LECTURER: { username: 'lecturer', role: 'LECTURER', display_name: 'อาจารย์ ทดสอบ' },
  STAFF: { username: 'staff', role: 'STAFF', display_name: 'เจ้าหน้าที่ ทดสอบ' },
  ADMIN: { username: 'admin', role: 'ADMIN', display_name: 'ผู้ดูแลระบบ' },
}

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: 'นักศึกษา',
  LECTURER: 'อาจารย์',
  STAFF: 'เจ้าหน้าที่',
  ADMIN: 'ผู้ดูแลระบบ',
}

const STORAGE_KEY = 'mockRole'
const listeners = new Set<() => void>()

function readRole(): UserRole {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in MOCK_USERS) return saved as UserRole
  } catch {
    // storage blocked: fall back to the student
  }
  return 'STUDENT'
}

let role: UserRole = readRole()

export const getMockUser = (): MockUser => MOCK_USERS[role]

export function setMockRole(next: UserRole) {
  role = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // not remembered across reloads, still switched for this tab
  }
  listeners.forEach((l) => l())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The current mock user; re-renders when the role switcher changes it */
export const useMockUser = (): MockUser => useSyncExternalStore(subscribe, getMockUser)
