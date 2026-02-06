'use client'
import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import Card from '@/components/ui/Card'

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null
  const sizeClasses = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className={`w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
        <div className="p-4 lg:p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg lg:text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </Card>
    </div>
  )
}


export default Modal
