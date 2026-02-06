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
import DeliveryReturnForm from '@/components/pages/DeliveryReturnForm'
import FormViewer from '@/components/pages/FormViewer'

const DriverTasksPage = ({ user, showToast }) => {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('today')
  const [selectedTask, setSelectedTask] = useState(null)
  const [showDeliveryForm, setShowDeliveryForm] = useState(false)
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [showFormView, setShowFormView] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('delivery_items')
        .select(`*, proposal:proposals(id, proposal_number, company:companies(id, name))`)
        .or(`delivery_driver_id.eq.${user.id},return_driver_id.eq.${user.id}`)
        .order('delivery_planned_date', { ascending: true })
      if (error) { console.error('driver tasks error:', error); setTasks([]); setLoading(false); return }
      setTasks(data || [])
    } catch (err) { console.error('driver loadData error:', err) }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const today = new Date().toISOString().split('T')[0]

  const todayTasks = tasks.filter(t => {
    const dDate = t.delivery_planned_date?.split('T')[0]
    const rDate = t.return_planned_date?.split('T')[0]
    const isDeliveryToday = dDate === today && t.delivery_status !== 'DELIVERED'
    const isReturnToday = rDate === today && t.return_status !== 'RETURNED'
    const isInTransit = t.delivery_status === 'IN_TRANSIT' || t.return_status === 'IN_TRANSIT'
    return isDeliveryToday || isReturnToday || isInTransit
  })

  const upcomingTasks = tasks.filter(t => {
    const dDate = t.delivery_planned_date?.split('T')[0]
    const rDate = t.return_planned_date?.split('T')[0]
    return (dDate > today && t.delivery_status !== 'DELIVERED') || (rDate > today && t.return_status !== 'RETURNED')
  })

  const completedTasks = tasks.filter(t => t.delivery_status === 'DELIVERED' || t.return_status === 'RETURNED')

  const handleDeliveryStatusChange = async (item, newStatus, machineStatus = null) => {
    try {
      const update = { delivery_status: newStatus, updated_at: new Date().toISOString() }
      if (newStatus === 'DELIVERED') update.delivery_completed_at = new Date().toISOString()
      await supabase.from('delivery_items').update(update).eq('id', item.id)
      if (machineStatus && item.assigned_machine_id) await supabase.from('fleet').update({ status: machineStatus }).eq('id', item.assigned_machine_id)
      showToast('Durum güncellendi', 'success'); loadData()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
  }

  const handleReturnStatusChange = async (item, newStatus, machineStatus = null) => {
    try {
      const update = { return_status: newStatus, updated_at: new Date().toISOString() }
      if (newStatus === 'RETURNED') update.return_completed_at = new Date().toISOString()
      await supabase.from('delivery_items').update(update).eq('id', item.id)
      if (machineStatus && item.assigned_machine_id) await supabase.from('fleet').update({ status: machineStatus }).eq('id', item.assigned_machine_id)
      showToast('Durum güncellendi', 'success'); loadData()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
  }

  const formatTime = (d) => d ? new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : ''

  const renderTask = (item) => {
    const isDeliveryTask = item.delivery_driver_id === user.id && item.delivery_status !== 'DELIVERED'
    const isReturnTask = item.return_driver_id === user.id && item.return_status !== 'RETURNED'

    return (
      <Card key={item.id} className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isDeliveryTask && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">📦 Teslimat</span>}
              {isReturnTask && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">🔄 İade</span>}
            </div>
            <h4 className="font-semibold text-gray-900 text-sm">{item.machine_type}</h4>
            <p className="text-xs text-gray-500">{item.proposal?.proposal_number} • {item.proposal?.company?.name}</p>
          </div>
          {item.assigned_machine_serial && <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{item.assigned_machine_serial}</span>}
        </div>

        {item.assigned_machine_name && <p className="text-xs text-gray-600 mb-1">🏗️ {item.assigned_machine_name}</p>}
        {isDeliveryTask && item.delivery_planned_date && <p className="text-xs text-gray-600 mb-1">⏰ {formatDate(item.delivery_planned_date)} {formatTime(item.delivery_planned_date)}</p>}
        {isReturnTask && item.return_planned_date && <p className="text-xs text-gray-600 mb-1">⏰ {formatDate(item.return_planned_date)} {formatTime(item.return_planned_date)}</p>}
        {item.delivery_route_notes && <p className="text-xs text-gray-600 mb-1">📍 {item.delivery_route_notes}</p>}
        {item.delivery_vehicle_plate && <p className="text-xs text-gray-600 mb-2">🚛 {item.delivery_vehicle_plate}</p>}

        <div className="flex gap-2 mt-3">
          {isDeliveryTask && item.delivery_status === 'PLANNED' && (
            <button onClick={() => handleDeliveryStatusChange(item, 'IN_TRANSIT')} className="flex-1 text-xs px-3 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">🚚 Yola Çıktım</button>
          )}
          {isDeliveryTask && item.delivery_status === 'IN_TRANSIT' && (
            <button onClick={() => { setSelectedTask(item); setShowDeliveryForm(true) }} className="flex-1 text-xs px-3 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700">📝 Teslim Formu</button>
          )}
          {isReturnTask && item.return_status === 'PLANNED' && (
            <button onClick={() => handleReturnStatusChange(item, 'IN_TRANSIT')} className="flex-1 text-xs px-3 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">🚚 Yola Çıktım</button>
          )}
          {isReturnTask && item.return_status === 'IN_TRANSIT' && (
            <button onClick={() => { setSelectedTask(item); setShowReturnForm(true) }} className="flex-1 text-xs px-3 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700">📝 İade Formu</button>
          )}
          {item.delivery_status === 'DELIVERED' && (
            <button onClick={() => setShowFormView({ item, type: 'delivery' })} className="flex-1 text-xs px-3 py-2 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200">📄 Teslimat Formu</button>
          )}
          {item.return_status === 'RETURNED' && (
            <button onClick={() => setShowFormView({ item, type: 'return' })} className="flex-1 text-xs px-3 py-2 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200">📄 İade Formu</button>
          )}
        </div>
      </Card>
    )
  }

  if (loading) return <div className="p-6 space-y-4">{[1,2,3].map(i => <SkeletonPulse key={i} className="w-full h-32 rounded-2xl" />)}</div>

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-bold text-gray-900">🚚 Görevlerim</h2>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'today', label: `Bugün (${todayTasks.length})` },
          { id: 'upcoming', label: `Yaklaşan (${upcomingTasks.length})` },
          { id: 'completed', label: `Tamamlanan (${completedTasks.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {activeTab === 'today' && todayTasks.map(renderTask)}
        {activeTab === 'upcoming' && upcomingTasks.map(renderTask)}
        {activeTab === 'completed' && completedTasks.map(renderTask)}
      </div>

      {activeTab === 'today' && todayTasks.length === 0 && <EmptyState icon={Truck} title="Bugün görev yok" description="Atanmış teslimat veya iade göreviniz bulunmuyor." />}
      {activeTab === 'upcoming' && upcomingTasks.length === 0 && <EmptyState icon={Calendar} title="Yaklaşan görev yok" description="Planlanmış yaklaşan göreviniz bulunmuyor." />}
      {activeTab === 'completed' && completedTasks.length === 0 && <EmptyState icon={CheckCircle2} title="Tamamlanan görev yok" description="Henüz tamamlanmış göreviniz bulunmuyor." />}

      {/* Delivery Form Modal */}
      <Modal isOpen={showDeliveryForm} onClose={() => setShowDeliveryForm(false)} title="📦 Teslimat Formu" size="lg">
        {selectedTask && <DeliveryReturnForm item={selectedTask} type="delivery" user={user} showToast={showToast}
          onComplete={() => { setShowDeliveryForm(false); loadData() }} onClose={() => setShowDeliveryForm(false)} />}
      </Modal>

      {/* Return Form Modal */}
      <Modal isOpen={showReturnForm} onClose={() => setShowReturnForm(false)} title="🔄 İade Formu" size="lg">
        {selectedTask && <DeliveryReturnForm item={selectedTask} type="return" user={user} showToast={showToast}
          onComplete={() => { setShowReturnForm(false); loadData() }} onClose={() => setShowReturnForm(false)} />}
      </Modal>

      {/* Form Viewer */}
      <Modal isOpen={!!showFormView} onClose={() => setShowFormView(null)} title={showFormView?.type === 'delivery' ? '📄 Teslimat Formu' : '📄 İade Formu'} size="lg">
        {showFormView && <FormViewer item={showFormView.item} type={showFormView.type} onClose={() => setShowFormView(null)} />}
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTENSIONS PAGE
// ═══════════════════════════════════════════════════════════════════════════



export default DriverTasksPage
