'use client'
import { Search, X } from 'lucide-react'

const SearchBar = ({ value, onChange, placeholder = 'Ara...', className = '' }) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
    <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent text-sm" />
    {value && <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// SEARCHABLE SELECT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════


export default SearchBar
