import axiosInstance from '../config/axios'
import type { AxiosRequestConfig } from 'axios'

// Generic API response type
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

/**
 * Generic GET request
 */
export const get = async <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response = await axiosInstance.get<T>(url, config)
    return {
      success: true,
      data: response.data,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    }
  }
}

/**
 * GET from the backend and unwrap its { success, message, data } envelope.
 * Throws with the backend message (joined if it is a list of validation errors).
 */
export const getData = async <T,>(url: string, params?: Record<string, string>): Promise<T> => {
  const res = await get<{ success: boolean; message: string | string[]; data: T }>(url, { params })
  if (!res.success || !res.data) {
    const error: unknown = res.error
    throw new Error((Array.isArray(error) ? error.join(', ') : String(error ?? '')) || 'Request failed')
  }
  return res.data.data
}

/**
 * Generic POST request
 */
export const post = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response = await axiosInstance.post<T>(url, data, config)
    return {
      success: true,
      data: response.data,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    }
  }
}

/**
 * Generic PUT request
 */
export const put = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response = await axiosInstance.put<T>(url, data, config)
    return {
      success: true,
      data: response.data,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    }
  }
}

/**
 * Generic DELETE request
 */
export const deleteRequest = async <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response = await axiosInstance.delete<T>(url, config)
    return {
      success: true,
      data: response.data,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    }
  }
}


/**
 * Error from a write endpoint, keeping the HTTP status so the UI can tell
 * 400 (fix the form) from 403 (not allowed) and 409 (slot taken).
 */
export class ApiError extends Error {
  readonly status: number
  readonly messages: string[]

  constructor(status: number, message: string | string[]) {
    const messages = Array.isArray(message) ? message : [message]
    super(messages.join(', '))
    this.status = status
    this.messages = messages
  }
}
