'use client'
import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, X, XCircle } from 'lucide-react'

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  const colors = { success: 'bg-emerald-500', error: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-blue-500' }
  return (
    <div className={`fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-[60]`}>
      {type === 'success' && <CheckCircle2 className="w-5 h-5" />}
      {type === 'error' && <XCircle className="w-5 h-5" />}
      <span className="text-sm">{message}</span>
    </div>
  )
}


export default Toast
