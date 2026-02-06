'use client'
import { useState, useCallback } from 'react'

export const useRecentlyViewed = (maxItems = 10) => {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('renth_recently_viewed') || '[]') } catch { return [] }
  })

  const addToRecent = useCallback((item) => {
    setItems(prev => {
      const filtered = prev.filter(i => i.id !== item.id)
      const next = [{ ...item, viewedAt: new Date().toISOString() }, ...filtered].slice(0, maxItems)
      localStorage.setItem('renth_recently_viewed', JSON.stringify(next))
      return next
    })
  }, [maxItems])

  return { recentItems: items, addToRecent }
}
