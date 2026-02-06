'use client'
import Card from '@/components/ui/Card'

const StatCard = ({ icon: Icon, label, value, variant = 'default' }) => {
  const variants = {
    default: { bg: 'bg-white', iconBg: 'bg-gray-100', iconColor: 'text-gray-600' },
    primary: { bg: 'bg-gradient-to-br from-[#F7B500] to-[#C49000]', iconBg: 'bg-white/20', iconColor: 'text-white' },
    navy: { bg: 'bg-gradient-to-br from-[#0A1628] to-[#1A2744]', iconBg: 'bg-white/10', iconColor: 'text-white' },
    success: { bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', iconBg: 'bg-white/20', iconColor: 'text-white' },
  }
  const v = variants[variant]
  const isLight = variant === 'default'
  return (
    <Card className={`p-4 lg:p-6 ${v.bg} ${!isLight ? 'text-white border-none shadow-xl' : ''}`}>
      <div className={`p-2.5 lg:p-3 rounded-xl ${v.iconBg} w-fit`}><Icon className={`w-5 h-5 lg:w-6 lg:h-6 ${v.iconColor}`} /></div>
      <div className="mt-3 lg:mt-4">
        <p className={`text-2xl lg:text-3xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>{value}</p>
        <p className={`text-xs lg:text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-white/70'}`}>{label}</p>
      </div>
    </Card>
  )
}


export default StatCard
