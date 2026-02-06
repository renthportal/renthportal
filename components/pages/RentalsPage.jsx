'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase, fixStorageUrl } from '@/lib/supabase'
import {
  Truck, Package, Calendar, Building, Clock, CheckCircle, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp, MapPin, User, RotateCcw,
  FileText, Download, Eye
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import SearchBar from '@/components/ui/SearchBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCards } from '@/components/ui/Skeleton'

const RentalsPage = ({ user, showToast, isAdmin, setActivePage }) => {
  const [deliveryItems, setDeliveryItems] = useState([])
  const [customers, setCustomers] = useState([])
  const [proposals, setProposals] = useState([])
  const [fleet, setFleet] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showDeliveryPlanModal, setShowDeliveryPlanModal] = useState(false)
  const [showReturnPlanModal, setShowReturnPlanModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [saving, setSaving] = useState(false)

  // Forms
  const [assignForm, setAssignForm] = useState({ machine_id: '' })
  const [deliveryPlanForm, setDeliveryPlanForm] = useState({ date: '', time: '', driver_id: '', plate: '', notes: '' })
  const [returnPlanForm, setReturnPlanForm] = useState({ date: '', time: '', driver_id: '', plate: '', notes: '' })

  const isCustomer = !isAdmin

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: custData } = await supabase.from('customers').select('id, company_name')
      setCustomers(custData || [])

      // Load proposals for grouping headers
      const { data: proposalsData } = await supabase.from('proposals').select('id, proposal_number, company_id, status')
      setProposals(proposalsData || [])

      if (!isCustomer) {
        const { data: fleetData } = await supabase
          .from('fleet')
          .select('id, serial_number, status, machine_id, machines(id, name)')
          .order('serial_number')
        setFleet(fleetData || [])

        const { data: driversData } = await supabase.from('users').select('id, full_name').eq('role', 'DRIVER')
        setDrivers(driversData || [])
      }

      let query = supabase.from('delivery_items').select('*').order('created_at', { ascending: false })
      if (isCustomer && user?.company_id) {
        query = query.eq('company_id', user.company_id)
      }
      const { data: itemsData } = await query
      setDeliveryItems(itemsData || [])
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
  }, [isCustomer, user])

  useEffect(() => { loadData() }, [loadData])

  const getCustomerName = (companyId) => customers.find(c => c.id === companyId)?.company_name || '-'
  const getProposalNo = (proposalId) => proposals.find(p => p.id === proposalId)?.proposal_number || '-'

  const getDeliveryStatusInfo = (status) => {
    const statuses = {
      'UNASSIGNED': { label: isCustomer ? 'Hazırlanıyor' : 'Makine Atanmadı', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle, border: '#ef4444' },
      'ASSIGNED': { label: isCustomer ? 'Hazırlanıyor' : 'Makine Atandı', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Package, border: '#f59e0b' },
      'PLANNED': { label: isCustomer ? 'Teslimat Planlandı' : 'Teslimat Planlandı', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Calendar, border: '#3b82f6' },
      'IN_TRANSIT': { label: 'Yolda', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Truck, border: '#8b5cf6' },
      'DELIVERED': { label: 'Teslim Edildi', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle, border: '#10b981' }
    }
    return statuses[status] || { label: status || '-', color: 'bg-gray-100 text-gray-700', icon: Clock, border: '#9ca3af' }
  }

  const getReturnStatusInfo = (status) => {
    const statuses = {
      'NONE': { label: '—', color: 'bg-gray-50 text-gray-400' },
      'PLANNED': { label: 'İade Planlandı', color: 'bg-orange-100 text-orange-700 border-orange-200' },
      'IN_TRANSIT': { label: 'İade Yolda', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      'RETURNED': { label: 'İade Edildi', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    }
    return statuses[status] || { label: '—', color: 'bg-gray-50 text-gray-400' }
  }

  const filteredItems = deliveryItems.filter(item => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'RETURN_PLANNED' && item.return_status !== 'PLANNED') return false
      else if (statusFilter === 'RETURNED' && item.return_status !== 'RETURNED') return false
      else if (!['RETURN_PLANNED', 'RETURNED'].includes(statusFilter) && item.delivery_status !== statusFilter) return false
    }
    if (search) {
      const s = search.toLowerCase()
      return item.machine_type?.toLowerCase().includes(s) ||
             getCustomerName(item.company_id).toLowerCase().includes(s) ||
             getProposalNo(item.proposal_id).toLowerCase().includes(s)
    }
    return true
  })

  // Group by proposal_id
  const groupedByProposal = filteredItems.reduce((acc, item) => {
    const key = item.proposal_id || 'no-proposal'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const getAvailableMachines = () => {
    return fleet.filter(f => {
      const s = (f.status || '').toLowerCase()
      return s === 'available' || s === 'müsait'
    })
  }

  // Makine Ata
  const openAssignModal = (item) => {
    setSelectedItem(item)
    setAssignForm({ machine_id: item.assigned_machine_id || '' })
    setShowAssignModal(true)
  }

  const handleAssign = async () => {
    if (!assignForm.machine_id) { showToast('Makine seçin', 'error'); return }
    setSaving(true)
    try {
      const machine = fleet.find(f => f.id === assignForm.machine_id)
      await supabase.from('delivery_items').update({
        assigned_machine_id: assignForm.machine_id,
        assigned_machine_serial: machine?.serial_number || '',
        assigned_machine_name: machine?.machines?.name || '',
        delivery_status: 'ASSIGNED'
      }).eq('id', selectedItem.id)

      await supabase.from('fleet').update({ status: 'reserved' }).eq('id', assignForm.machine_id)
      showToast('Makine atandı', 'success')
      setShowAssignModal(false)
      loadData()
    } catch (err) {
      showToast('Atama başarısız: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // Teslimat Planla
  const openDeliveryPlanModal = (item) => {
    setSelectedItem(item)
    setDeliveryPlanForm({ date: '', time: '', driver_id: '', plate: '', notes: '' })
    setShowDeliveryPlanModal(true)
  }

  const handleDeliveryPlan = async () => {
    if (!deliveryPlanForm.date) { showToast('Tarih seçin', 'error'); return }
    setSaving(true)
    try {
      // Combine date + time into timestamptz
      const dateTime = deliveryPlanForm.time 
        ? `${deliveryPlanForm.date}T${deliveryPlanForm.time}:00` 
        : `${deliveryPlanForm.date}T09:00:00`

      await supabase.from('delivery_items').update({
        delivery_planned_date: dateTime,
        delivery_driver_id: deliveryPlanForm.driver_id || null,
        delivery_vehicle_plate: deliveryPlanForm.plate || null,
        delivery_route_notes: deliveryPlanForm.notes || null,
        delivery_status: 'PLANNED'
      }).eq('id', selectedItem.id)

      showToast('Teslimat planlandı', 'success')
      setShowDeliveryPlanModal(false)
      loadData()
    } catch (err) {
      showToast('Planlama başarısız: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // Teslim Edildi
  const handleDelivered = async (item) => {
    if (!confirm('Bu makine teslim edildi olarak işaretlensin mi?')) return
    try {
      await supabase.from('delivery_items').update({
        delivery_status: 'DELIVERED',
        delivery_completed_at: new Date().toISOString(),
        delivery_completed_by: user?.id || null
      }).eq('id', item.id)

      if (item.assigned_machine_id) {
        await supabase.from('fleet').update({ status: 'rented', customer_id: item.company_id }).eq('id', item.assigned_machine_id)
      }

      showToast('Teslim edildi olarak işaretlendi', 'success')
      loadData()
    } catch (err) {
      showToast('İşlem başarısız: ' + err.message, 'error')
    }
  }

  // İade Planla
  const openReturnPlanModal = (item) => {
    setSelectedItem(item)
    setReturnPlanForm({ date: '', time: '', driver_id: '', plate: '', notes: '' })
    setShowReturnPlanModal(true)
  }

  const handleReturnPlan = async () => {
    if (!returnPlanForm.date) { showToast('Tarih seçin', 'error'); return }
    setSaving(true)
    try {
      const dateTime = returnPlanForm.time 
        ? `${returnPlanForm.date}T${returnPlanForm.time}:00` 
        : `${returnPlanForm.date}T09:00:00`

      await supabase.from('delivery_items').update({
        return_planned_date: dateTime,
        return_driver_id: returnPlanForm.driver_id || null,
        return_vehicle_plate: returnPlanForm.plate || null,
        return_route_notes: returnPlanForm.notes || null,
        return_status: 'PLANNED'
      }).eq('id', selectedItem.id)

      showToast('İade planlandı', 'success')
      setShowReturnPlanModal(false)
      loadData()
    } catch (err) {
      showToast('İade planlama başarısız: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // İade Edildi
  const handleReturned = async (item) => {
    if (!confirm('Bu makine iade edildi olarak işaretlensin mi?')) return
    try {
      await supabase.from('delivery_items').update({
        return_status: 'RETURNED',
        return_completed_at: new Date().toISOString(),
        return_completed_by: user?.id || null
      }).eq('id', item.id)

      if (item.assigned_machine_id) {
        await supabase.from('fleet').update({ status: 'available', customer_id: null }).eq('id', item.assigned_machine_id)
      }

      showToast('İade edildi olarak işaretlendi', 'success')
      loadData()
    } catch (err) {
      showToast('İşlem başarısız: ' + err.message, 'error')
    }
  }

  // Stats
  const stats = {
    unassigned: deliveryItems.filter(i => i.delivery_status === 'UNASSIGNED').length,
    assigned: deliveryItems.filter(i => i.delivery_status === 'ASSIGNED').length,
    planned: deliveryItems.filter(i => i.delivery_status === 'PLANNED').length,
    delivered: deliveryItems.filter(i => i.delivery_status === 'DELIVERED').length,
    returnPlanned: deliveryItems.filter(i => i.return_status === 'PLANNED').length,
    returned: deliveryItems.filter(i => i.return_status === 'RETURNED').length
  }

  if (loading) return <div className="p-6"><SkeletonCards count={4} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isCustomer ? 'Teslimatlarım' : 'Teslimatlar'}</h1>
          <p className="text-sm text-gray-500">{deliveryItems.length} teslimat kalemi</p>
        </div>
        <Button variant="outline" icon={RefreshCw} onClick={loadData}>Yenile</Button>
      </div>

      {/* Stats - Staff only */}
      {!isCustomer && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Card className="p-3 bg-red-50 border-red-200">
            <p className="text-2xl font-bold text-red-700">{stats.unassigned}</p>
            <p className="text-xs text-red-600">Atanmadı</p>
          </Card>
          <Card className="p-3 bg-yellow-50 border-yellow-200">
            <p className="text-2xl font-bold text-yellow-700">{stats.assigned}</p>
            <p className="text-xs text-yellow-600">Atandı</p>
          </Card>
          <Card className="p-3 bg-blue-50 border-blue-200">
            <p className="text-2xl font-bold text-blue-700">{stats.planned}</p>
            <p className="text-xs text-blue-600">Planlandı</p>
          </Card>
          <Card className="p-3 bg-emerald-50 border-emerald-200">
            <p className="text-2xl font-bold text-emerald-700">{stats.delivered}</p>
            <p className="text-xs text-emerald-600">Teslim Edildi</p>
          </Card>
          <Card className="p-3 bg-orange-50 border-orange-200">
            <p className="text-2xl font-bold text-orange-700">{stats.returnPlanned}</p>
            <p className="text-xs text-orange-600">İade Planlı</p>
          </Card>
          <Card className="p-3 bg-teal-50 border-teal-200">
            <p className="text-2xl font-bold text-teal-700">{stats.returned}</p>
            <p className="text-xs text-teal-600">İade Edildi</p>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Makine, müşteri, teklif ara..." className="flex-1 max-w-md" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
          <option value="all">Tüm Durumlar</option>
          <option value="UNASSIGNED">Makine Atanmadı</option>
          <option value="ASSIGNED">Makine Atandı</option>
          <option value="PLANNED">Teslimat Planlandı</option>
          <option value="DELIVERED">Teslim Edildi</option>
          <option value="RETURN_PLANNED">İade Planlandı</option>
          <option value="RETURNED">İade Edildi</option>
        </select>
      </div>

      {/* Teslimat Listesi - Teklife Göre Gruplu */}
      {Object.keys(groupedByProposal).length === 0 ? (
        <EmptyState icon={Truck} title="Teslimat bulunamadı" description={isCustomer ? "Henüz teslimat kaydınız yok." : "Kriterlere uygun teslimat kalemi yok."} />
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByProposal).map(([proposalId, items]) => {
            const proposal = proposals.find(p => p.id === proposalId)
            const customerName = getCustomerName(items[0]?.company_id)
            const isExpanded = expandedId === proposalId

            return (
              <Card key={proposalId} className="overflow-hidden">
                {/* Proje Header */}
                <div className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => setExpandedId(isExpanded ? null : proposalId)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <p className="font-bold text-gray-900">{proposal?.proposal_number || 'Teklif Yok'}</p>
                        {!isCustomer && <p className="text-sm text-gray-500 flex items-center gap-1"><Building className="w-4 h-4" />{customerName}</p>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {items.filter(i => i.delivery_status === 'UNASSIGNED').length > 0 && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            {items.filter(i => i.delivery_status === 'UNASSIGNED').length} atanmadı
                          </span>
                        )}
                        {items.filter(i => i.delivery_status === 'DELIVERED').length > 0 && (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            {items.filter(i => i.delivery_status === 'DELIVERED').length}/{items.length} teslim
                          </span>
                        )}
                        {items.filter(i => i.return_status === 'RETURNED').length > 0 && (
                          <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                            {items.filter(i => i.return_status === 'RETURNED').length} iade
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Makine Kalemleri */}
                {isExpanded && (
                  <div className="divide-y">
                    {items.map(item => {
                      const dStatus = getDeliveryStatusInfo(item.delivery_status)
                      const rStatus = getReturnStatusInfo(item.return_status)
                      const StatusIcon = dStatus.icon

                      return (
                        <div key={item.id} className="p-4" style={{ borderLeft: `4px solid ${dStatus.border}` }}>
                          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h4 className="font-semibold text-gray-900">{item.machine_type}</h4>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${dStatus.color}`}>
                                  <StatusIcon className="w-3 h-3" />{dStatus.label}
                                </span>
                                {item.return_status && item.return_status !== 'NONE' && (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${rStatus.color}`}>{rStatus.label}</span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                <span>{item.duration} {item.period}</span>
                                {item.assigned_machine_serial && !isCustomer && (
                                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">SN: {item.assigned_machine_serial}</span>
                                )}
                                {item.delivery_planned_date && (
                                  <span className="text-blue-600 flex items-center gap-1 text-xs">
                                    <Calendar className="w-3 h-3" />Teslimat: {new Date(item.delivery_planned_date).toLocaleDateString('tr-TR')}
                                    {' '}{new Date(item.delivery_planned_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                {item.delivery_completed_at && (
                                  <span className="text-emerald-600 flex items-center gap-1 text-xs">
                                    <CheckCircle className="w-3 h-3" />Teslim: {new Date(item.delivery_completed_at).toLocaleDateString('tr-TR')}
                                  </span>
                                )}
                                {item.return_planned_date && (
                                  <span className="text-orange-600 flex items-center gap-1 text-xs">
                                    <RotateCcw className="w-3 h-3" />İade Plan: {new Date(item.return_planned_date).toLocaleDateString('tr-TR')}
                                    {' '}{new Date(item.return_planned_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                {item.return_completed_at && (
                                  <span className="text-teal-600 flex items-center gap-1 text-xs">
                                    <CheckCircle className="w-3 h-3" />İade: {new Date(item.return_completed_at).toLocaleDateString('tr-TR')}
                                  </span>
                                )}
                              </div>

                              {!isCustomer && (item.delivery_vehicle_plate || item.return_vehicle_plate) && (
                                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                  {item.delivery_vehicle_plate && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />Teslimat: {item.delivery_vehicle_plate}</span>}
                                  {item.return_vehicle_plate && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />İade: {item.return_vehicle_plate}</span>}
                                </div>
                              )}

                              {/* Customer: View form PDFs */}
                              {isCustomer && (
                                <div className="flex gap-2 mt-2 flex-wrap">
                                  {item.delivery_signature_url && (
                                    <button onClick={(e) => { e.stopPropagation(); window.open(fixStorageUrl(item.delivery_signature_url), '_blank') }} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
                                      <FileText className="w-3 h-3" />Teslimat Formu
                                    </button>
                                  )}
                                  {item.return_signature_url && (
                                    <button onClick={(e) => { e.stopPropagation(); window.open(fixStorageUrl(item.return_signature_url), '_blank') }} className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 flex items-center gap-1">
                                      <FileText className="w-3 h-3" />İade Formu
                                    </button>
                                  )}
                                  {item.delivery_pdf_url && (
                                    <button onClick={(e) => { e.stopPropagation(); window.open(fixStorageUrl(item.delivery_pdf_url), '_blank') }} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                                      <Download className="w-3 h-3" />Teslimat PDF
                                    </button>
                                  )}
                                  {item.return_pdf_url && (
                                    <button onClick={(e) => { e.stopPropagation(); window.open(fixStorageUrl(item.return_pdf_url), '_blank') }} className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 flex items-center gap-1">
                                      <Download className="w-3 h-3" />İade PDF
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Aksiyonlar - Staff Only */}
                            {!isCustomer && (
                              <div className="flex flex-wrap gap-2 flex-shrink-0">
                                {item.delivery_status === 'UNASSIGNED' && (
                                  <Button size="sm" variant="primary" icon={Package} onClick={() => openAssignModal(item)}>Makine Ata</Button>
                                )}
                                {item.delivery_status === 'ASSIGNED' && (
                                  <Button size="sm" variant="primary" icon={Calendar} onClick={() => openDeliveryPlanModal(item)}>Teslimat Planla</Button>
                                )}
                                {item.delivery_status === 'PLANNED' && (
                                  <Button size="sm" variant="success" icon={CheckCircle} onClick={() => handleDelivered(item)}>Teslim Edildi</Button>
                                )}
                                {item.delivery_status === 'DELIVERED' && (!item.return_status || item.return_status === 'NONE') && (
                                  <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => openReturnPlanModal(item)}>İade Planla</Button>
                                )}
                                {item.return_status === 'PLANNED' && (
                                  <Button size="sm" variant="warning" icon={RotateCcw} onClick={() => handleReturned(item)}>İade Edildi</Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ═══ Makine Ata Modal ═══ */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Makine Ata" size="md">
        <div className="p-6 space-y-4">
          {selectedItem && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold">{selectedItem.machine_type}</p>
              <p className="text-sm text-gray-500">{selectedItem.duration} {selectedItem.period}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Makine Seçin *</label>
            <select value={assignForm.machine_id} onChange={(e) => setAssignForm({ machine_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">Makine seçin...</option>
              {getAvailableMachines().map(m => (
                <option key={m.id} value={m.id}>{m.serial_number} - {m.machines?.name || 'Makine'} [{m.status}]</option>
              ))}
            </select>
            {getAvailableMachines().length === 0 && <p className="text-sm text-red-500 mt-1">Müsait makine bulunamadı</p>}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowAssignModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleAssign} loading={saving}>Ata</Button>
          </div>
        </div>
      </Modal>

      {/* ═══ Teslimat Planla Modal ═══ */}
      <Modal isOpen={showDeliveryPlanModal} onClose={() => setShowDeliveryPlanModal(false)} title="Teslimat Planla" size="md">
        <div className="p-6 space-y-4">
          {selectedItem && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold">{selectedItem.machine_type}</p>
              <p className="text-sm text-blue-600">{selectedItem.assigned_machine_serial} - {selectedItem.assigned_machine_name}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tarih *" type="date" value={deliveryPlanForm.date} onChange={(e) => setDeliveryPlanForm(p => ({ ...p, date: e.target.value }))} />
            <Input label="Saat" type="time" value={deliveryPlanForm.time} onChange={(e) => setDeliveryPlanForm(p => ({ ...p, time: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şoför</label>
            <select value={deliveryPlanForm.driver_id} onChange={(e) => setDeliveryPlanForm(p => ({ ...p, driver_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">Şoför seçin...</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          <Input label="Araç Plakası" value={deliveryPlanForm.plate} onChange={(e) => setDeliveryPlanForm(p => ({ ...p, plate: e.target.value }))} placeholder="34 ABC 123" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teslimat Notu</label>
            <textarea value={deliveryPlanForm.notes} onChange={(e) => setDeliveryPlanForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Adres, yol tarifi..." />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeliveryPlanModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleDeliveryPlan} loading={saving}>Planla</Button>
          </div>
        </div>
      </Modal>

      {/* ═══ İade Planla Modal ═══ */}
      <Modal isOpen={showReturnPlanModal} onClose={() => setShowReturnPlanModal(false)} title="İade Planla" size="md">
        <div className="p-6 space-y-4">
          {selectedItem && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold">{selectedItem.machine_type}</p>
              <p className="text-sm text-blue-600">{selectedItem.assigned_machine_serial} - {selectedItem.assigned_machine_name}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tarih *" type="date" value={returnPlanForm.date} onChange={(e) => setReturnPlanForm(p => ({ ...p, date: e.target.value }))} />
            <Input label="Saat" type="time" value={returnPlanForm.time} onChange={(e) => setReturnPlanForm(p => ({ ...p, time: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şoför</label>
            <select value={returnPlanForm.driver_id} onChange={(e) => setReturnPlanForm(p => ({ ...p, driver_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">Şoför seçin...</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          <Input label="Araç Plakası" value={returnPlanForm.plate} onChange={(e) => setReturnPlanForm(p => ({ ...p, plate: e.target.value }))} placeholder="34 ABC 123" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İade Notu</label>
            <textarea value={returnPlanForm.notes} onChange={(e) => setReturnPlanForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Adres, yol tarifi..." />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowReturnPlanModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleReturnPlan} loading={saving}>Planla</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default RentalsPage
