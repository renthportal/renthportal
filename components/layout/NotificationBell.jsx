'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, BellDot, X, Check, Eye, FileText, Wrench, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const NotificationBell = ({ user, isAdmin }) => {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    const load = async () => {
      const items = []
      if (isAdmin) {
        const { count: pendingCount } = await supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'PENDING')
        if (pendingCount > 0) items.push({ id: 'pending', icon: FileText, text: `${pendingCount} yeni teklif talebi bekliyor`, type: 'warning', time: 'Şimdi' })
        const { count: rejectedCount } = await supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED')
        if (rejectedCount > 0) items.push({ id: 'rejected', icon: FileText, text: `${rejectedCount} teklif reddedildi - revize gerekli`, type: 'error', time: 'Şimdi' })
        const { count: serviceCount } = await supabase.from('service_requests').select('*', { count: 'exact', head: true }).in('status', ['OPEN'])
        if (serviceCount > 0) items.push({ id: 'service', icon: Wrench, text: `${serviceCount} yeni servis talebi`, type: 'error', time: 'Şimdi' })
      } else {
        const { count: quotedCount } = await supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('company_id', user?.company_id).eq('status', 'QUOTED')
        if (quotedCount > 0) items.push({ id: 'quoted', icon: FileText, text: `${quotedCount} teklifiniz onay bekliyor`, type: 'warning', time: 'Şimdi' })
      }
      if (items.length === 0) items.push({ id: 'empty', icon: CheckCircle2, text: 'Yeni bildirim yok', type: 'success', time: '' })
      setNotifications(items)
    }
    load()
  }, [user, isAdmin])

  useEffect(() => {
    const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasUnread = notifications.length > 0 && notifications[0].id !== 'empty'
  const typeColors = { warning: 'text-amber-500', info: 'text-blue-500', error: 'text-red-500', success: 'text-emerald-500' }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
        <Bell className="w-5 h-5 text-gray-600" />
        {hasUnread && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#C41E3A] rounded-full" />}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">Bildirimler</h4>
            {hasUnread && <span className="text-xs bg-[#C41E3A] text-white px-2 py-0.5 rounded-full">{notifications.filter(n => n.id !== 'empty').length}</span>}
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {notifications.map(n => (
              <div key={n.id} className="p-3 hover:bg-gray-50 flex items-start gap-3">
                <div className={`mt-0.5 ${typeColors[n.type]}`}><n.icon className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{n.text}</p>
                  {n.time && <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN PAGE (WITH SECURITY)
// ═══════════════════════════════════════════════════════════════════════════


export default NotificationBell
