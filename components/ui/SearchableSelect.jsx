'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X, Check } from 'lucide-react'

const SearchableSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Seçin...',
  searchPlaceholder = 'Ara...',
  label,
  error,
  disabled,
  className = '',
  renderOption,
  getOptionLabel = (opt) => opt?.label || opt?.name || opt,
  getOptionValue = (opt) => opt?.value || opt?.id || opt,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // Dışarı tıklanınca kapat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Açılınca input'a focus
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Seçili option
  const selectedOption = options.find(opt => getOptionValue(opt) === value)

  // Filtrelenmiş options
  const filteredOptions = options.filter(opt => {
    if (!search) return true
    const label = getOptionLabel(opt)
    return label?.toLowerCase().includes(search.toLowerCase())
  })

  const handleSelect = (opt) => {
    onChange(getOptionValue(opt))
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    setSearch('')
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2.5 text-left
          border rounded-lg bg-white transition-colors
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer'}
          ${error ? 'border-red-300' : 'border-gray-300'}
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : ''}
        `}
      >
        <span className={`truncate ${selectedOption ? 'text-gray-900' : 'text-gray-400'}`}>
          {selectedOption ? getOptionLabel(selectedOption) : placeholder}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {value && !disabled && (
            <X 
              className="w-4 h-4 text-gray-400 hover:text-gray-600" 
              onClick={handleClear}
            />
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[300px]">
          {/* Search Input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                Sonuç bulunamadı
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const optValue = getOptionValue(opt)
                const optLabel = getOptionLabel(opt)
                const isSelected = optValue === value

                return (
                  <button
                    key={optValue || idx}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`
                      w-full px-3 py-2.5 text-left text-sm flex items-center justify-between
                      hover:bg-gray-50 transition-colors
                      ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                    `}
                  >
                    <span className="truncate pr-2" title={optLabel}>{optLabel}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}

export default SearchableSelect
