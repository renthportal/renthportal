'use client'

const Tabs = ({ tabs, activeTab, onChange }) => (
  <div className="flex border-b border-gray-200 overflow-x-auto">
    {tabs.map(tab => (
      <button key={tab.id} onClick={() => onChange(tab.id)}
        className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-[#F7B500] text-[#0A1628]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
        {tab.label}
        {tab.count > 0 && <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-[#F7B500] text-[#0A1628]' : 'bg-gray-100 text-gray-600'}`}>{tab.count}</span>}
      </button>
    ))}
  </div>
)


export default Tabs
