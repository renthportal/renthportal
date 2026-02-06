'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Subscribe to realtime changes on a Supabase table.
 * @param {string} table - Table name to subscribe to
 * @param {string} event - 'INSERT' | 'UPDATE' | 'DELETE' | '*'
 * @param {function} callback - Called with the payload on change
 * @param {object} filter - Optional filter e.g. { column: 'company_id', value: '123' }
 * @param {boolean} enabled - Whether subscription is active
 */
export const useRealtimeSubscription = (table, event = '*', callback, filter = null, enabled = true) => {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled || !table) return

    let channel = supabase.channel(`realtime-${table}-${Date.now()}`)

    const config = {
      event,
      schema: 'public',
      table,
    }

    if (filter?.column && filter?.value) {
      config.filter = `${filter.column}=eq.${filter.value}`
    }

    channel = channel.on('postgres_changes', config, (payload) => {
      callbackRef.current?.(payload)
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, event, filter?.column, filter?.value, enabled])
}
