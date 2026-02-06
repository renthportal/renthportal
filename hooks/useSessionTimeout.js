'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { SESSION_DURATION_MS, SESSION_WARNING_MS } from '@/lib/constants'

export const useSessionTimeout = (user, onLogout, showToast) => {
  const [sessionWarning, setSessionWarning] = useState(false)
  const timerRef = useRef(null)
  const warningRef = useRef(null)

  const resetTimer = useCallback(() => {
    if (!user) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
    setSessionWarning(false)

    localStorage.setItem('session_expiry', String(Date.now() + SESSION_DURATION_MS))

    warningRef.current = setTimeout(() => {
      setSessionWarning(true)
      showToast?.('Oturumunuz 1 saat içinde sona erecek', 'warning')
    }, SESSION_DURATION_MS - SESSION_WARNING_MS)

    timerRef.current = setTimeout(() => {
      setSessionWarning(false)
      showToast?.('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.', 'error')
      onLogout?.()
    }, SESSION_DURATION_MS)
  }, [user, onLogout, showToast])

  const extendSession = useCallback(() => {
    resetTimer()
    showToast?.('Oturum süreniz uzatıldı', 'success')
  }, [resetTimer, showToast])

  useEffect(() => {
    if (!user) return

    resetTimer()

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    const handler = () => resetTimer()
    events.forEach(e => window.addEventListener(e, handler, { passive: true }))

    return () => {
      events.forEach(e => window.removeEventListener(e, handler))
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [user, resetTimer])

  return { sessionWarning, extendSession }
}
