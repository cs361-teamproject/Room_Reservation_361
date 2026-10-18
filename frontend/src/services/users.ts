import type { Me } from '../auth/context'
import { send } from './api'
import axiosInstance from '../config/axios'

/** Who the Bearer token belongs to, with the role from the User table */
export const getMe = (): Promise<Me> => send(axiosInstance.get('/users/me'))
