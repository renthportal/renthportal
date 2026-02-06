import { SESSION_DURATION_MS, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS } from './constants'

export const getLoginAttempts = (email) => {
  try {
    const data = JSON.parse(localStorage.getItem(`login_attempts_${email}`) || '{}')
    if (data.lockUntil && Date.now() > data.lockUntil) {
      localStorage.removeItem(`login_attempts_${email}`)
      return { count: 0, lockUntil: null }
    }
    return data
  } catch { return { count: 0, lockUntil: null } }
}

export const setLoginAttempts = (email, attempts) => {
  localStorage.setItem(`login_attempts_${email}`, JSON.stringify(attempts))
}

export const clearLoginAttempts = (email) => {
  localStorage.removeItem(`login_attempts_${email}`)
}

export const isAccountLocked = (email) => {
  const attempts = getLoginAttempts(email)
  return attempts.lockUntil && Date.now() < attempts.lockUntil
}

export const recordFailedLogin = (email) => {
  const attempts = getLoginAttempts(email)
  const count = (attempts.count || 0) + 1
  if (count >= MAX_LOGIN_ATTEMPTS) {
    setLoginAttempts(email, { count, lockUntil: Date.now() + LOCKOUT_DURATION_MS })
    return true // locked
  }
  setLoginAttempts(email, { count, lockUntil: null })
  return false
}

export const getSessionExpiry = () => {
  try {
    return parseInt(localStorage.getItem('session_expiry') || '0', 10)
  } catch { return 0 }
}

export const setSessionExpiry = () => {
  localStorage.setItem('session_expiry', String(Date.now() + SESSION_DURATION_MS))
}

export const isSessionValid = () => {
  const expiry = getSessionExpiry()
  return expiry > Date.now()
}
