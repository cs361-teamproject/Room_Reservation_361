import axios from 'axios'
import type { AxiosInstance } from 'axios'
import { fetchAuthSession } from 'aws-amplify/auth'
import { authConfigured } from './amplify'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10)
const ENABLE_DEBUG = import.meta.env.VITE_ENABLE_DEBUG === 'true'

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** The Cognito ID token of the logged-in user; Amplify refreshes it when it is about to expire */
async function idToken(): Promise<string | undefined> {
  if (!authConfigured) return undefined
  try {
    return (await fetchAuthSession()).tokens?.idToken?.toString()
  } catch {
    return undefined
  }
}

axiosInstance.interceptors.request.use(async (config) => {
  const token = await idToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (ENABLE_DEBUG) console.log('📤 Request:', { url: config.url, method: config.method, data: config.data })
  return config
})

axiosInstance.interceptors.response.use(
  (response) => {
    if (ENABLE_DEBUG) console.log('📥 Response:', { url: response.config.url, status: response.status, data: response.data })
    return response
  },
  (error) => {
    // 401 on a page that needs a login: the session is gone (expired refresh token, logged out elsewhere)
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.href = `/login?next=${next}`
    }
    if (ENABLE_DEBUG) {
      console.error('❌ Response Error:', { status: error.response?.status, url: error.config?.url, data: error.response?.data })
    }
    return Promise.reject(error)
  },
)

export default axiosInstance
