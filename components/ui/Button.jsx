'use client'
import { RefreshCw } from 'lucide-react'

const Button = ({ children, variant = 'primary', size = 'md', icon: Icon, loading, disabled, className = '', ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-[#C41E3A] hover:bg-[#9A1A2E] text-white focus:ring-[#C41E3A] shadow-lg shadow-red-500/20',
    secondary: 'bg-[#111111] hover:bg-[#222222] text-white focus:ring-[#111111]',
    outline: 'border-2 border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white focus:ring-[#111111]',
    ghost: 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#111111] focus:ring-[#111111]',
    danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500',
    success: 'bg-emerald-500 hover:bg-emerald-600 text-white focus:ring-emerald-500',
    warning: 'bg-orange-500 hover:bg-orange-600 text-white focus:ring-orange-500',
  }
  const sizes = { sm: 'text-xs px-3 py-1.5 gap-1.5', md: 'text-sm px-4 py-2 gap-2', lg: 'text-base px-6 py-3 gap-2' }
  return (
    <button className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
      {children}
    </button>
  )
}


export default Button
