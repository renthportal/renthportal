'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Download, X, AlertTriangle } from 'lucide-react'

// Lib
import { supabase } from '@/lib/supabase'
import { SESSION_DURATION_MS, isAdminRole, isStaffRole, isDriverRole } from '@/lib/constants'
import { logAudit } from '@/lib/audit'

// Hooks
import { useMobile } from '@/hooks/useMobile'
import { useSessionTimeout } from '@/hooks/useSessionTimeout'

// UI
import Toast from '@/components/ui/Toast'

// Layout
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

// Auth
import LoginPage from '@/components/auth/LoginPage'
import KvkkConsentScreen from '@/components/auth/KvkkConsentScreen'
import MyAccountPage from '@/components/auth/MyAccountPage'

// Pages
import DashboardPage from '@/components/pages/DashboardPage'
import CustomersPage from '@/components/pages/CustomersPage'
import CategoriesPage from '@/components/pages/CategoriesPage'
import MachinesPage from '@/components/pages/MachinesPage'
import ProposalsPage from '@/components/pages/ProposalsPage'
import ContractsPage from '@/components/pages/ContractsPage'
import ProjectsPage from '@/components/pages/ProjectsPage'
import RentalsPage from '@/components/pages/RentalsPage'
import DriverTasksPage from '@/components/pages/DriverTasksPage'
import ExtensionsPage from '@/components/pages/ExtensionsPage'
import ServicesPage from '@/components/pages/ServicesPage'
import FinancePage from '@/components/pages/FinancePage'
import MachineCatalogPage from '@/components/pages/MachineCatalogPage'
import StaffPage from '@/components/pages/StaffPage'
import FleetPage from '@/components/pages/FleetPage'
import MessagesPage from '@/components/pages/MessagesPage'
import SurveyPage from '@/components/pages/SurveyPage'
import RequestQuotePage from '@/components/pages/RequestQuotePage'
import AuditLogPage from '@/components/pages/AuditLogPage'
import VisitsPage from '@/components/pages/VisitsPage'
import InvoicePlanPage from '@/components/pages/InvoicePlanPage'
import TechnicianTasksPage from '@/components/pages/TechnicianTasksPage'

// ═══════════════════════════════════════════════════════════════════════════
// PAGE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const PAGE_CONFIG = {
  dashboard: { title: 'Dashboard', subtitle: '' },
  catalog: { title: 'Makineler', subtitle: 'Kiralık makineler' },
  request: { title: 'Teklif Talebi', subtitle: '' },
  customers: { title: 'Müşteriler', subtitle: '' },
  staff: { title: 'Çalışanlar', subtitle: 'Satış ve operasyon ekibi' },
  machines: { title: 'Makine Tipleri', subtitle: 'Katalog yönetimi' },
  fleet: { title: 'Filo Envanteri', subtitle: 'Tüm fiziksel makineler' },
  proposals: { title: 'Teklifler', subtitle: '' },
  visits: { title: 'Ziyaretler', subtitle: 'Müşteri ziyaret takibi' },
  contracts: { title: 'Teklifler', subtitle: '' },
  projects: { title: 'Proje Takip', subtitle: 'Aktif kiralama ve sözleşme takibi' },
  rentals: { title: 'Teslimatlar', subtitle: 'Makine teslimat ve iade takibi' },
  'driver-tasks': { title: 'Görevlerim', subtitle: '' },
  extensions: { title: 'Uzatma Talepleri', subtitle: '' },
  services: { title: 'Servis Talepleri', subtitle: '' },
  finance: { title: 'Finans', subtitle: '' },
  'invoice-plans': { title: 'Fatura Planı', subtitle: 'Dönemsel fatura planlaması' },
  'tech-tasks': { title: 'Servis Görevlerim', subtitle: 'Atanan servis görevleri' },
  messages: { title: 'Mesajlar', subtitle: '' },
  surveys: { title: 'Değerlendirmeler', subtitle: '' },
  account: { title: 'Hesabım', subtitle: '' },
  audit: { title: 'İşlem Kayıtları', subtitle: '' },
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function RenthPortal() {
  const [user, setUser] = useState(null)
  const [activePage, setActivePage] = useState('dashboard')
  const [toast, setToast] = useState(null)
  const [pendingCounts, setPendingCounts] = useState({})
  const [selectedMachineForQuote, setSelectedMachineForQuote] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [needsConsent, setNeedsConsent] = useState(false)
  const isMobile = useMobile()

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const handleRequestQuote = useCallback((machine) => {
    setSelectedMachineForQuote(machine)
    setActivePage('request')
  }, [])

  const handleLogout = useCallback(() => {
    if (user) logAudit(user.id, user.full_name, 'LOGOUT', {})
    setUser(null)
    setActivePage('dashboard')
    setNeedsConsent(false)
    localStorage.removeItem('renth_user')
    localStorage.removeItem('renth_login_at')
  }, [user])

  const { sessionWarning, extendSession } = useSessionTimeout(user, handleLogout, showToast)

  const loadPendingCounts = useCallback(async (u) => {
    if (!u) return
    const staff = isStaffRole(u.role)
    let pq = supabase.from('proposals').select('*', { count: 'exact', head: true })
    let sq = supabase.from('service_requests').select('*', { count: 'exact', head: true })
    let eq = supabase.from('extensions').select('*', { count: 'exact', head: true }).eq('status', 'PENDING')
    let mq = supabase.from('conversations').select('*', { count: 'exact', head: true })
    if (staff) {
      pq = pq.eq('status', 'PENDING')
      sq = sq.in('status', ['OPEN', 'ASSIGNED'])
      mq = mq.eq('admin_read', false)
    } else {
      pq = pq.eq('company_id', u.company_id).eq('status', 'QUOTED')
      sq = sq.eq('company_id', u.company_id).in('status', ['OPEN', 'ASSIGNED', 'IN_PROGRESS'])
      mq = mq.eq('company_id', u.company_id).eq('customer_read', false)
    }
    const [proposals, services, extensions, msgs] = await Promise.all([pq, sq, eq, mq])
    setPendingCounts({
      proposals: proposals.count || 0,
      services: services.count || 0,
      extensions: extensions.count || 0,
      messages: msgs.count || 0,
    })
  }, [])

  // Restore session on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('renth_user')
    if (saved) {
      const u = JSON.parse(saved)
      const loginAt = localStorage.getItem('renth_login_at')
      if (loginAt && (Date.now() - parseInt(loginAt)) >= SESSION_DURATION_MS) {
        localStorage.removeItem('renth_user')
        localStorage.removeItem('renth_login_at')
        showToast('Oturum süreniz doldu. Lütfen tekrar giriş yapın.', 'error')
        return
      }
      setUser(u)
      if (isDriverRole(u.role)) setActivePage('driver-tasks')
      if (!isStaffRole(u.role) && !isDriverRole(u.role) && (!u.kvkk_consent_at || !u.terms_consent_at)) {
        setNeedsConsent(true)
      }
      loadPendingCounts(u)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // PWA: Register Service Worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                showToast('Yeni sürüm mevcut! Sayfa yenilenecek.', 'info')
                setTimeout(() => window.location.reload(), 2000)
              }
            })
          }
        })
      }).catch((err) => console.warn('SW registration failed:', err))
    }
  }, [showToast])

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (!localStorage.getItem('renth_pwa_dismissed')) setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') showToast('Uygulama yüklendi! 🎉', 'success')
    setDeferredPrompt(null)
    setShowInstallBanner(false)
  }

  const dismissInstallBanner = () => {
    setShowInstallBanner(false)
    localStorage.setItem('renth_pwa_dismissed', Date.now().toString())
  }

  const handleLogin = useCallback((u) => {
    setUser(u)
    localStorage.setItem('renth_user', JSON.stringify(u))
    localStorage.setItem('renth_login_at', Date.now().toString())
    if (isDriverRole(u.role)) setActivePage('driver-tasks')
    if (!isStaffRole(u.role) && !isDriverRole(u.role) && (!u.kvkk_consent_at || !u.terms_consent_at)) {
      setNeedsConsent(true)
    }
    loadPendingCounts(u)
  }, [loadPendingCounts])

  const handleConsent = useCallback((updatedUser) => {
    setUser(updatedUser)
    localStorage.setItem('renth_user', JSON.stringify(updatedUser))
    setNeedsConsent(false)
  }, [])

  const handleUserUpdate = useCallback((updatedUser) => {
    setUser(updatedUser)
    localStorage.setItem('renth_user', JSON.stringify(updatedUser))
  }, [])

  // ─── Auth gates ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <>
        <LoginPage onLogin={handleLogin} showToast={showToast} />
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </>
    )
  }

  if (needsConsent) {
    return (
      <>
        <KvkkConsentScreen user={user} onConsent={handleConsent} showToast={showToast} />
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </>
    )
  }

  const isAdmin = isAdminRole(user.role) || user.role === 'STAFF'
  const isStaff = isStaffRole(user.role)

  // ─── Page router ────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage user={user} isAdmin={isAdmin} isStaff={isStaff} setActivePage={setActivePage} />
      case 'catalog': return <MachineCatalogPage user={user} showToast={showToast} onRequestQuote={handleRequestQuote} />
      case 'request': return <RequestQuotePage user={user} showToast={showToast} preselectedMachine={selectedMachineForQuote} />
      case 'customers': return isStaff ? <CustomersPage showToast={showToast} setActivePage={setActivePage} /> : null
      case 'staff': return isAdmin ? <StaffPage showToast={showToast} /> : null
      case 'categories': return isAdmin ? <CategoriesPage showToast={showToast} /> : null
      case 'machines': return isAdmin ? <MachinesPage showToast={showToast} /> : null
      case 'fleet': return isStaff ? <FleetPage showToast={showToast} isAdmin={isAdmin} setActivePage={setActivePage} /> : null
      case 'proposals': return <ProposalsPage user={user} showToast={showToast} isAdmin={isStaff} setActivePage={setActivePage} />
      case 'visits': return isStaff ? <VisitsPage user={user} showToast={showToast} isAdmin={isAdmin} setActivePage={setActivePage} /> : null
      case 'contracts': return <ProposalsPage user={user} showToast={showToast} isAdmin={isStaff} setActivePage={setActivePage} />
      case 'projects': return <ProjectsPage user={user} showToast={showToast} isAdmin={isStaff} setActivePage={setActivePage} />
      case 'rentals': return <RentalsPage user={user} showToast={showToast} isAdmin={isStaff} setActivePage={setActivePage} />
      case 'driver-tasks': return <DriverTasksPage user={user} showToast={showToast} />
      case 'extensions': return isAdmin ? <ExtensionsPage user={user} showToast={showToast} /> : null
      case 'services': return <ServicesPage user={user} showToast={showToast} isAdmin={isStaff} setActivePage={setActivePage} />
      case 'tech-tasks': return <TechnicianTasksPage user={user} showToast={showToast} />
      case 'finance': return <FinancePage user={user} showToast={showToast} isAdmin={isStaff} />
      case 'invoice-plans': return <InvoicePlanPage user={user} showToast={showToast} isAdmin={isStaff} />
      case 'messages': return <MessagesPage user={user} showToast={showToast} isAdmin={isStaff} />
      case 'surveys': return <SurveyPage user={user} showToast={showToast} isAdmin={isAdmin} />
      case 'account': return <MyAccountPage user={user} showToast={showToast} onUserUpdate={handleUserUpdate} onLogout={handleLogout} />
      case 'audit': return isAdmin ? <AuditLogPage showToast={showToast} /> : null
      default: return <DashboardPage user={user} isAdmin={isAdmin} isStaff={isStaff} setActivePage={setActivePage} />
    }
  }

  const pc = PAGE_CONFIG[activePage] || PAGE_CONFIG.dashboard

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        user={user}
        activePage={activePage}
        setActivePage={setActivePage}
        onLogout={handleLogout}
        pendingCounts={pendingCounts}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <main className={`min-h-screen ${isMobile ? '' : 'ml-64'}`}>
        <Header title={pc.title} subtitle={pc.subtitle} isMobile={isMobile} onMenuClick={() => setSidebarOpen(true)} user={user} isAdmin={isStaff} />

        {/* Session Warning */}
        {sessionWarning && (
          <div className="mx-4 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800">Oturumunuz yakında sona erecek.</p>
            </div>
            <button onClick={extendSession} className="text-sm font-medium text-amber-700 hover:text-amber-900 bg-amber-100 px-3 py-1 rounded-lg whitespace-nowrap">
              Oturumu Uzat
            </button>
          </div>
        )}

        {/* PWA Install Banner */}
        {showInstallBanner && (
          <div className="mx-4 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-800">RenthPortal'ı cihazınıza yükleyin, daha hızlı erişin!</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleInstallPWA} className="text-sm font-medium text-white bg-[#C41E3A] hover:bg-[#a01830] px-3 py-1 rounded-lg whitespace-nowrap">Yükle</button>
              <button onClick={dismissInstallBanner} className="p-1 hover:bg-blue-100 rounded-lg text-blue-400"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {renderPage()}
      </main>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
