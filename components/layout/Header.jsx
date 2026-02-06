'use client'
import { Menu } from 'lucide-react'
import NotificationBell from './NotificationBell'

const Header = ({ title, subtitle, isMobile, onMenuClick, user, isAdmin }) => (
  <header className="h-14 lg:h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
    <div className="flex items-center gap-3">
      {isMobile && <button onClick={onMenuClick} className="p-2 -ml-2 rounded-lg hover:bg-gray-100"><Menu className="w-5 h-5 text-gray-600" /></button>}
      <div><h1 className="text-base lg:text-xl font-bold text-gray-900">{title}</h1>{subtitle && <p className="text-xs lg:text-sm text-gray-500 hidden sm:block">{subtitle}</p>}</div>
    </div>
    <NotificationBell user={user} isAdmin={isAdmin} />
  </header>
)

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS PAGE (with pagination)
// ═══════════════════════════════════════════════════════════════════════════


export default Header
