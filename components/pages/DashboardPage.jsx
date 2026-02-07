'use client'
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase, fixStorageUrl, resolveImageSrc, compressImageToBlob } from '@/lib/supabase'
import {
  LayoutDashboard, FileText, FileSignature, Truck, Wallet, Headphones, Bell, Settings,
  LogOut, ChevronRight, ChevronDown, Plus, Search, Filter, Calendar, X, Check,
  Building2, Users, Package, BarChart3, MessageSquare, Wrench, TrendingUp, TrendingDown,
  Clock, CheckCircle2, AlertCircle, XCircle, Eye, EyeOff, Edit, Download, Send, RefreshCw,
  MapPin, Phone, Mail, User, Lock, ArrowRight, Menu, Upload, Save,
  AlertTriangle, Trash2, QrCode, Image, FileCheck, Camera, ChevronLeft, File,
  BookOpen, Shield, Award, Clipboard, ClipboardCheck, ExternalLink, Heart, Star,
  ArrowLeft, ChevronsLeft, ChevronsRight, BellDot, Megaphone
} from 'lucide-react'
import { STATUS_CONFIG, ROLES, ROLE_LABELS, isAdminRole, isStaffRole, isSalesRole, isOpsRole, isDriverRole,
  RENTAL_TYPES, DURATION_OPTIONS, PAYMENT_TERMS, CURRENCIES, MACHINE_CONDITIONS,
  ACTIVITY_TYPES, ACTIVITY_TYPE_ICONS, ACTIVITY_TYPE_COLORS, PAGE_SIZE,
  PARENT_GROUPS, GROUP_CONFIG, ALL_GROUPS, extractSpec,
  DELIVERY_STATUS_CONFIG, RETURN_STATUS_CONFIG } from '@/lib/constants'
import { logAudit } from '@/lib/audit'
import { turkeyData, cities, getDistricts } from '@/lib/turkey-data'
import StatusBadge from '@/components/ui/StatusBadge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import Tabs from '@/components/ui/Tabs'
import StatCard from '@/components/ui/StatCard'
import EmptyState from '@/components/ui/EmptyState'
import SearchBar from '@/components/ui/SearchBar'
import SearchableSelect from '@/components/ui/SearchableSelect'
import FavoriteStar from '@/components/ui/FavoriteStar'
import { SkeletonPulse, SkeletonStats, SkeletonTable, SkeletonCards } from '@/components/ui/Skeleton'
import Pagination, { paginate } from '@/components/ui/Pagination'

const DashboardPage = ({ user, isAdmin, isStaff, setActivePage }) => {
  const [stats, setStats] = useState({})
  const [recentProposals, setRecentProposals] = useState([])
  const [deliveryStats, setDeliveryStats] = useState(null)
  const [missingPlanCount, setMissingPlanCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    if (isStaff) {
      const [companies, machines, proposals, services, activeDeliveries] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('machines').select('*'),
        supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('service_requests').select('*', { count: 'exact', head: true }).in('status', ['OPEN', 'ASSIGNED', 'IN_PROGRESS']),
        supabase.from('delivery_items').select('*', { count: 'exact', head: true }).eq('delivery_status', 'DELIVERED').or('return_status.is.null,return_status.neq.RETURNED'),
      ])
      setStats({ companies: companies.count || 0, machines: machines.data?.length || 0, availableMachines: machines.data?.filter(m => m.status === 'AVAILABLE').length || 0, pendingProposals: proposals.count || 0, openServices: services.count || 0, activeRentals: activeDeliveries.count || 0 })
    } else {
      const [proposals, services, activeDeliveries] = await Promise.all([
        supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('company_id', user.company_id).in('status', ['PENDING', 'QUOTED']),
        supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('company_id', user.company_id).in('status', ['OPEN', 'ASSIGNED', 'IN_PROGRESS']),
        supabase.from('delivery_items').select('*', { count: 'exact', head: true }).eq('company_id', user.company_id).eq('delivery_status', 'DELIVERED').or('return_status.is.null,return_status.neq.RETURNED'),
      ])
      setStats({ pendingProposals: proposals.count || 0, openServices: services.count || 0, activeRentals: activeDeliveries.count || 0 })
    }
    // Delivery items stats
    let diQuery = supabase.from('delivery_items').select('delivery_status, return_status, company_id')
    if (!isStaff && user?.company_id) diQuery = diQuery.eq('company_id', user.company_id)
    const { data: diData } = await diQuery
    if (diData) {
      setDeliveryStats({
        waiting: diData.filter(d => ['UNASSIGNED','ASSIGNED'].includes(d.delivery_status)).length,
        planned: diData.filter(d => d.delivery_status === 'PLANNED').length,
        inTransit: diData.filter(d => d.delivery_status === 'IN_TRANSIT').length,
        delivered: diData.filter(d => d.delivery_status === 'DELIVERED').length,
        returnPlanned: diData.filter(d => d.return_status === 'PLANNED').length,
        returnTransit: diData.filter(d => d.return_status === 'IN_TRANSIT').length,
        returned: diData.filter(d => d.return_status === 'RETURNED').length,
      })
    }
    // Missing invoice plans check (staff only)
    if (isStaff) {
      const now = new Date()
      const cmStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const { data: delivered } = await supabase.from('delivery_items').select('proposal_id').eq('delivery_status', 'DELIVERED').or('return_status.is.null,return_status.neq.RETURNED')
      if (delivered?.length) {
        const proposalIds = [...new Set(delivered.map(d => d.proposal_id))]
        const { data: existingPlans } = await supabase.from('invoice_plans').select('proposal_id').eq('period_start', cmStart).neq('status', 'CANCELLED').in('proposal_id', proposalIds)
        const coveredIds = new Set((existingPlans || []).map(p => p.proposal_id))
        setMissingPlanCount(proposalIds.filter(id => !coveredIds.has(id)).length)
      }
    }
    // Recent proposals
    let rpQuery = supabase.from('proposals').select('*, company:companies(name)').order('created_at', { ascending: false }).limit(5)
    if (!isStaff && user?.company_id) rpQuery = rpQuery.eq('company_id', user.company_id)
    const { data: rpData } = await rpQuery
    setRecentProposals(rpData || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  if (loading) return <div className="p-6 space-y-6"><SkeletonStats count={isStaff ? 6 : 3} /><SkeletonPulse className="w-full h-48 rounded-2xl" /><SkeletonTable rows={3} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <p className="text-gray-500 text-sm">Hoş geldiniz, {user?.full_name}!</p>

      {/* Stat Cards */}
      {isStaff ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
          <StatCard icon={Building2} label="Toplam Müşteri" value={stats.companies} variant="navy" />
          <StatCard icon={Package} label="Toplam Makine" value={stats.machines} />
          <StatCard icon={CheckCircle2} label="Müsait Makine" value={stats.availableMachines} variant="success" />
          <StatCard icon={FileText} label="Bekleyen Teklif" value={stats.pendingProposals} variant="primary" />
          <StatCard icon={Truck} label="Aktif Kiralama" value={stats.activeRentals} />
          <StatCard icon={Wrench} label="Açık Servis" value={stats.openServices} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-6">
          <StatCard icon={Truck} label="Aktif Kiralama" value={stats.activeRentals} variant="primary" />
          <StatCard icon={FileText} label="Bekleyen Teklif" value={stats.pendingProposals} variant="navy" />
          <StatCard icon={Wrench} label="Açık Servis" value={stats.openServices} />
        </div>
      )}

      {/* Quick Actions */}
      <Card className="p-4 lg:p-6">
        <h3 className="font-semibold text-gray-900 mb-4 text-sm">Hızlı İşlemler</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(isStaff ? [
            { label: 'Teklifler', icon: FileText, page: 'proposals', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100', badge: stats.pendingProposals },
            { label: 'Sözleşmeler', icon: FileSignature, page: 'contracts', color: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
            { label: 'Kiralamalar', icon: Truck, page: 'rentals', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
            { label: 'Servis', icon: Wrench, page: 'services', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100', badge: stats.openServices },
          ] : [
            { label: 'Yeni Talep', icon: Plus, page: 'request', color: 'bg-[#C41E3A]/10 text-[#C41E3A] hover:bg-[#C41E3A]/20' },
            { label: 'Tekliflerim', icon: FileText, page: 'proposals', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100', badge: stats.pendingProposals },
            { label: 'Makineler', icon: Package, page: 'catalog', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
            { label: 'Servis Talebi', icon: Wrench, page: 'services', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
          ]).map(action => (
            <button key={action.page} onClick={() => setActivePage && setActivePage(action.page)} className={`p-3 lg:p-4 rounded-xl ${action.color} transition-colors flex flex-col items-center gap-2 relative`}>
              <action.icon className="w-6 h-6" />
              <span className="text-xs lg:text-sm font-medium">{action.label}</span>
              {action.badge > 0 && <span className="absolute top-1 right-1 bg-[#C41E3A] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{action.badge}</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* Delivery & Return Overview Widget */}
      {deliveryStats && (deliveryStats.waiting + deliveryStats.planned + deliveryStats.inTransit + deliveryStats.delivered + deliveryStats.returnPlanned + deliveryStats.returnTransit + deliveryStats.returned) > 0 && (
        <Card className="p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Truck className="w-5 h-5 text-[#C41E3A]" /><h3 className="font-semibold text-gray-900 text-sm">Teslimat & İade Özeti</h3></div>
            <button onClick={() => setActivePage && setActivePage('rentals')} className="text-xs text-[#C41E3A] hover:underline">Detay →</button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            {/* Teslimat */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">📦 Teslimat</p>
              <div className="space-y-1.5">
                {deliveryStats.waiting > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-400" /><span className="text-xs text-gray-600">Makine Bekliyor</span></div>
                    <span className="text-sm font-bold text-gray-700">{deliveryStats.waiting}</span>
                  </div>
                )}
                {deliveryStats.planned > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-xs text-amber-700">Planlandı</span></div>
                    <span className="text-sm font-bold text-amber-700">{deliveryStats.planned}</span>
                  </div>
                )}
                {deliveryStats.inTransit > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /><span className="text-xs text-blue-700">Yolda</span></div>
                    <span className="text-sm font-bold text-blue-700">{deliveryStats.inTransit}</span>
                  </div>
                )}
                {deliveryStats.delivered > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-xs text-emerald-700">Teslim Edildi</span></div>
                    <span className="text-sm font-bold text-emerald-700">{deliveryStats.delivered}</span>
                  </div>
                )}
              </div>
            </div>
            {/* İade */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">🔄 İade</p>
              <div className="space-y-1.5">
                {deliveryStats.returnPlanned > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-50">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500" /><span className="text-xs text-orange-700">Planlı</span></div>
                    <span className="text-sm font-bold text-orange-700">{deliveryStats.returnPlanned}</span>
                  </div>
                )}
                {deliveryStats.returnTransit > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /><span className="text-xs text-blue-700">Yolda</span></div>
                    <span className="text-sm font-bold text-blue-700">{deliveryStats.returnTransit}</span>
                  </div>
                )}
                {deliveryStats.returned > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-xs text-emerald-700">İade Edildi</span></div>
                    <span className="text-sm font-bold text-emerald-700">{deliveryStats.returned}</span>
                  </div>
                )}
                {(deliveryStats.returnPlanned + deliveryStats.returnTransit + deliveryStats.returned) === 0 && (
                  <div className="flex items-center justify-center px-3 py-4 rounded-lg bg-gray-50">
                    <span className="text-xs text-gray-400">Henüz iade yok</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Notifications / Announcements */}
      <Card className="p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-4"><Megaphone className="w-5 h-5 text-[#C41E3A]" /><h3 className="font-semibold text-gray-900 text-sm">Duyurular & Bildirimler</h3></div>
        <div className="space-y-3">
          {stats.pendingProposals > 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => setActivePage && setActivePage('proposals')}>
              <div className="mt-0.5"><AlertCircle className="w-5 h-5 text-amber-500" /></div>
              <div><p className="text-sm font-medium text-amber-900">{isStaff ? `${stats.pendingProposals} yeni teklif talebi bekliyor` : `${stats.pendingProposals} teklifiniz yanıt bekliyor`}</p><p className="text-xs text-amber-600 mt-0.5">Teklifler sayfasına git →</p></div>
            </div>
          )}
          {isStaff && missingPlanCount > 0 && (
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl cursor-pointer hover:bg-red-100 transition-colors" onClick={() => setActivePage && setActivePage('invoice-plans')}>
              <div className="mt-0.5"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <div><p className="text-sm font-medium text-red-900">{missingPlanCount} proje için bu ay fatura planı eksik!</p><p className="text-xs text-red-600 mt-0.5">Fatura planı sayfasına git →</p></div>
            </div>
          )}
          {stats.activeRentals > 0 && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
              <div className="mt-0.5"><Truck className="w-5 h-5 text-blue-500" /></div>
              <div><p className="text-sm font-medium text-blue-900">{stats.activeRentals} aktif kiralamanız bulunuyor</p><p className="text-xs text-blue-600 mt-0.5">Tüm kiralamalar güncel durumda</p></div>
            </div>
          )}
          {stats.pendingProposals === 0 && stats.activeRentals === 0 && (
            <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl">
              <div className="mt-0.5"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
              <div><p className="text-sm font-medium text-emerald-900">Her şey yolunda!</p><p className="text-xs text-emerald-600 mt-0.5">Yeni bildirim yok</p></div>
            </div>
          )}
        </div>
      </Card>

      {/* Recent Proposals */}
      {recentProposals.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Son Teklifler</h3>
            <button onClick={() => setActivePage && setActivePage('proposals')} className="text-sm text-[#C41E3A] hover:underline">Tümünü Gör</button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentProposals.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => setActivePage && setActivePage('proposals')}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-1 h-8 rounded-full ${STATUS_CONFIG[p.status]?.dot || 'bg-gray-300'}`} />
                  <div className="min-w-0"><p className="font-medium text-sm text-gray-900 truncate">{p.proposal_number}</p>{isAdmin && <p className="text-xs text-gray-500 truncate">{p.company?.name}</p>}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={p.status} size="sm" />
                  <span className="text-xs text-gray-400 hidden sm:block">{new Date(p.created_at).toLocaleDateString('tr-TR')}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PROPOSAL PDF GENERATOR
// ═══════════════════════════════════════════════════════════════════════════



export default DashboardPage
