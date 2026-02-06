'use client'
import {
  LayoutDashboard, FileText, FileSignature, Truck, Wallet,
  LogOut, Users, Package, Wrench, Building2, Calculator,
  ClipboardCheck, MapPin, MessageSquare, Star,
  X, Plus, Clock, User
} from 'lucide-react'
import Logo from '@/components/ui/Logo'
import { ROLE_LABELS, isAdminRole, isStaffRole, isSalesRole, isOpsRole, isDriverRole } from '@/lib/constants'

export default function Sidebar({ user, activePage, setActivePage, onLogout, pendingCounts, isMobile, sidebarOpen, setSidebarOpen }) {
  const role = user?.role
  const isAdmin = isAdminRole(role) || role === 'STAFF'

  const customerMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'catalog', label: 'Makineler', icon: Package },
    { id: 'request', label: 'Teklif Talebi', icon: Plus },
    { id: 'proposals', label: 'Tekliflerim', icon: FileText, badge: pendingCounts?.proposals },
    { id: 'projects', label: 'Proje Takip', icon: ClipboardCheck },
    { id: 'rentals', label: 'Teslimatlarım', icon: Truck },
    { id: 'services', label: 'Servis Talepleri', icon: Wrench, badge: pendingCounts?.services },
    { id: 'finance', label: 'Finans', icon: Wallet },
    { id: 'messages', label: 'Mesajlar', icon: MessageSquare, badge: pendingCounts?.messages },
    { id: 'surveys', label: 'Değerlendirmeler', icon: Star },
    { id: 'account', label: 'Hesabım', icon: User },
  ]

  const salesMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Müşteriler', icon: Building2 },
    { id: 'visits', label: 'Ziyaretler', icon: MapPin },
    { id: 'proposals', label: 'Teklifler', icon: FileText, badge: pendingCounts?.proposals },
    { id: 'projects', label: 'Proje Takip', icon: ClipboardCheck },
    { id: 'rentals', label: 'Teslimatlar', icon: Truck },
    { id: 'fleet', label: 'Filo Envanteri', icon: Package },
    { id: 'services', label: 'Servis Talepleri', icon: Wrench, badge: pendingCounts?.services },
    { id: 'finance', label: 'Finans', icon: Wallet },
    { id: 'invoice-plans', label: 'Fatura Planı', icon: Calculator },
    { id: 'messages', label: 'Mesajlar', icon: MessageSquare, badge: pendingCounts?.messages },
    { id: 'account', label: 'Hesabım', icon: User },
  ]

  const operationsMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tech-tasks', label: 'Servis Görevlerim', icon: Wrench },
    { id: 'fleet', label: 'Filo Envanteri', icon: Package },
    { id: 'projects', label: 'Proje Takip', icon: ClipboardCheck },
    { id: 'rentals', label: 'Teslimatlar', icon: Truck },
    { id: 'services', label: 'Servis Talepleri', icon: Wrench, badge: pendingCounts?.services },
    { id: 'messages', label: 'Mesajlar', icon: MessageSquare, badge: pendingCounts?.messages },
    { id: 'account', label: 'Hesabım', icon: User },
  ]

  const driverMenu = [
    { id: 'driver-tasks', label: 'Görevlerim', icon: Truck },
    { id: 'account', label: 'Profilim', icon: User },
  ]

  const adminMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Müşteriler', icon: Building2 },
    { id: 'staff', label: 'Çalışanlar', icon: Users },
    { id: 'visits', label: 'Ziyaretler', icon: MapPin },
    { id: 'machines', label: 'Makine Tipleri', icon: Package },
    { id: 'fleet', label: 'Filo Envanteri', icon: Truck },
    { id: 'proposals', label: 'Teklifler', icon: FileText, badge: pendingCounts?.proposals },
    { id: 'projects', label: 'Proje Takip', icon: ClipboardCheck },
    { id: 'rentals', label: 'Teslimatlar', icon: Truck },
    { id: 'extensions', label: 'Uzatma Talepleri', icon: Clock, badge: pendingCounts?.extensions },
    { id: 'services', label: 'Servis Talepleri', icon: Wrench, badge: pendingCounts?.services },
    { id: 'finance', label: 'Finans', icon: Wallet },
    { id: 'invoice-plans', label: 'Fatura Planı', icon: Calculator },
    { id: 'messages', label: 'Mesajlar', icon: MessageSquare, badge: pendingCounts?.messages },
    { id: 'surveys', label: 'Değerlendirmeler', icon: Star },
    { id: 'audit', label: 'İşlem Kayıtları', icon: ClipboardCheck },
    { id: 'account', label: 'Hesabım', icon: User },
  ]

  const menu = isAdmin ? adminMenu : isSalesRole(role) ? salesMenu : isOpsRole(role) ? operationsMenu : isDriverRole(role) ? driverMenu : customerMenu

  const closeSidebar = () => {
    if (setSidebarOpen) setSidebarOpen(false)
  }

  const navigateTo = (pageId) => {
    if (setActivePage) setActivePage(pageId)
    if (isMobile) closeSidebar()
  }

  const handleLogout = () => {
    if (onLogout) onLogout()
  }

  const content = (
    <aside className={`w-64 bg-[#111111] text-white flex flex-col h-full ${isMobile ? '' : 'fixed inset-y-0 left-0 z-30'}`}>
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 flex-shrink-0">
        <Logo size="md" />
        {isMobile && (
          <button onClick={closeSidebar} className="p-2 text-gray-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {menu.map(item => {
            const Icon = item.icon
            const isActive = activePage === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-[#C41E3A] text-white font-semibold shadow-lg shadow-red-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-left text-sm">{item.label}</span>
                  {item.badge > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#C41E3A]/20 text-[#C41E3A]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 p-2">
          <div className="w-10 h-10 bg-gradient-to-br from-[#C41E3A] to-[#9A1A2E] rounded-full flex items-center justify-center text-white font-bold text-sm">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.company?.name || ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )

  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={closeSidebar}
        />
        <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {content}
        </div>
      </>
    )
  }

  return content
}
