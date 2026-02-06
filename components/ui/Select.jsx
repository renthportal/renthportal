'use client'

const Select = ({ label, options = [], className = '', children, ...props }) => (
  <div className={className}>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
    <select className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F7B500] focus:border-transparent transition-all" {...props}>
      {children ? children : options.map((opt, i) => <option key={i} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
)

export default Select
