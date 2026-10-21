import type { Me } from '../auth/context'
import type { UserRole } from '../types/booking'
import { send } from './api'
import axiosInstance from '../config/axios'

/** Who the Bearer token belongs to, with the role from the User table */
export const getMe = (): Promise<Me> => send(axiosInstance.get('/users/me'))

export interface UserOption {
  id: string
  username: string
  display_name: string | null
  role: UserRole
}

/** STAFF/ADMIN: people a room can be booked for */
export const getUsers = (roles: UserRole[]): Promise<UserOption[]> =>
  send(axiosInstance.get('/users', { params: { role: roles.join(',') } }))
