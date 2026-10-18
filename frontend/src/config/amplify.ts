import { Amplify } from 'aws-amplify'

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID

/** True when the Cognito env is set; without it the site still works logged out */
export const authConfigured = Boolean(userPoolId && userPoolClientId)

if (authConfigured) {
  // Login happens in our own form (pages/Login.tsx), so no Hosted UI / OAuth settings
  Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId } } })
} else {
  console.warn('VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_CLIENT_ID are not set: login is disabled')
}
