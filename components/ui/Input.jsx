'use client'
import { forwardRef } from 'react'

const Input = ({ label, icon: Icon, error, className = '', ...props }) => (
  <div className={className}>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
    <div className="relative">
      {Icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Icon className="w-5 h-5 text-gray-400" /></div>}
      <input className={`w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F7B500] focus:border-transparent transition-all ${Icon ? 'pl-10' : ''} ${error ? 'border-red-500' : ''}`} {...props} />
    </div>
    {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
  </div>
)


export default Input
