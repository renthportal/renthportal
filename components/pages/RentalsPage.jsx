'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, fixStorageUrl, resolveImageSrc, compressImageToBlob } from '@/lib/supabase'
import {
  Truck, Package, Calendar, Building, Clock, CheckCircle, RefreshCw,
  ChevronDown, ChevronUp, FileText, Download, MapPin, Camera, Check,
  AlertTriangle, RotateCcw, Search, Eye, X, Fuel, Gauge, User,
  ClipboardCheck, ArrowRight, Filter
} from 'lucide-react'
import { MACHINE_CONDITIONS } from '@/lib/constants'
import { openPdfContent } from '@/lib/helpers'
import { RENTH_LOGO_B64 as LOGO_B64 } from '@/lib/pdf'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCards } from '@/components/ui/Skeleton'

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const DELIVERY_FLOW = {
  UNASSIGNED:  { label: 'Makine Atanmadı', color: 'bg-gray-100 text-gray-600', icon: Package, customer: 'Hazırlanıyor' },
  ASSIGNED:    { label: 'Makine Atandı', color: 'bg-yellow-100 text-yellow-700', icon: Package, customer: 'Hazırlanıyor' },
  PLANNED:     { label: 'Teslimat Planlandı', color: 'bg-blue-100 text-blue-700', icon: Calendar, customer: 'Teslimat Planlandı' },
  IN_TRANSIT:  { label: 'Yolda', color: 'bg-purple-100 text-purple-700', icon: Truck, customer: 'Yolda' },
  DELIVERED:   { label: 'Teslim Edildi', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, customer: 'Teslim Edildi' },
}
const RETURN_FLOW = {
  NONE:        { label: '—', color: 'bg-gray-50 text-gray-400' },
  PLANNED:     { label: 'İade Planlandı', color: 'bg-orange-100 text-orange-700', customer: 'İade Planlanıyor' },
  IN_TRANSIT:  { label: 'İade Yolda', color: 'bg-blue-100 text-blue-700', customer: 'İade Yolda' },
  RETURNED:    { label: 'İade Edildi', color: 'bg-emerald-100 text-emerald-700', customer: 'İade Edildi' },
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const RentalsPage = ({ user, showToast, isAdmin }) => {
  const [items, setItems] = useState([])
  const [proposals, setProposals] = useState([])
  const [customers, setCustomers] = useState([])
  const [drivers, setDrivers] = useState([])
  const [fleet, setFleet] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedProposal, setExpandedProposal] = useState(null)

  // Modals
  const [assignModal, setAssignModal] = useState(null)      // item
  const [planModal, setPlanModal] = useState(null)           // { item, type: 'delivery'|'return' }
  const [formModal, setFormModal] = useState(null)           // { item, type: 'delivery'|'return' }
  const [viewModal, setViewModal] = useState(null)           // { item, type: 'delivery'|'return' }
  const [saving, setSaving] = useState(false)

  const isCustomer = !isAdmin

  // ─── Load Data ───
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: custData } = await supabase.from('customers').select('id, company_name')
      setCustomers(custData || [])

      let diQuery = supabase.from('delivery_items').select('*').order('item_index')
      if (isCustomer && user?.company_id) diQuery = diQuery.eq('company_id', user.company_id)
      const { data: diData } = await diQuery
      setItems(diData || [])

      const proposalIds = [...new Set((diData || []).map(d => d.proposal_id).filter(Boolean))]
      if (proposalIds.length > 0) {
        const { data: propData } = await supabase.from('proposals').select('id, proposal_number, company_id').in('id', proposalIds)
        setProposals(propData || [])
      }

      if (isAdmin) {
        const { data: drvData } = await supabase.from('users').select('id, full_name, role').in('role', ['DRIVER', 'OPERATIONS'])
        setDrivers(drvData || [])
        const { data: fleetData } = await supabase.from('fleet').select('id, serial_number, status, machine_id, machines(id, name)').order('serial_number')
        setFleet(fleetData || [])
      }
    } catch (err) { console.error('Load error:', err) }
    setLoading(false)
  }, [isCustomer, isAdmin, user])

  useEffect(() => { loadData() }, [loadData])

  // ─── Helpers ───
  const getCustomerName = (cid) => customers.find(c => c.id === cid)?.company_name || '-'
  const getProposal = (pid) => proposals.find(p => p.id === pid)
  const getAvailableFleet = () => fleet.filter(f => ['available', 'müsait'].includes((f.status || '').toLowerCase()))

  const groupedByProposal = items.reduce((acc, item) => {
    const pid = item.proposal_id || 'none'
    if (!acc[pid]) acc[pid] = []
    acc[pid].push(item)
    return acc
  }, {})

  // ─── Stats (staff) ───
  const stats = {
    unassigned: items.filter(i => i.delivery_status === 'UNASSIGNED').length,
    assigned: items.filter(i => i.delivery_status === 'ASSIGNED').length,
    planned: items.filter(i => i.delivery_status === 'PLANNED').length,
    delivered: items.filter(i => i.delivery_status === 'DELIVERED' && i.return_status !== 'RETURNED').length,
    returnPlanned: items.filter(i => i.return_status === 'PLANNED').length,
    returned: items.filter(i => i.return_status === 'RETURNED').length,
  }

  // ─── Filters ───
  const filteredGroups = Object.entries(groupedByProposal).filter(([pid, groupItems]) => {
    const proposal = getProposal(pid)
    if (search) {
      const s = search.toLowerCase()
      const matches = proposal?.proposal_number?.toLowerCase().includes(s) ||
        getCustomerName(proposal?.company_id).toLowerCase().includes(s) ||
        groupItems.some(i => i.machine_type?.toLowerCase().includes(s))
      if (!matches) return false
    }
    if (statusFilter !== 'all') {
      const hasMatch = groupItems.some(i => {
        if (statusFilter === 'unassigned') return i.delivery_status === 'UNASSIGNED'
        if (statusFilter === 'planned') return i.delivery_status === 'PLANNED'
        if (statusFilter === 'delivered') return i.delivery_status === 'DELIVERED' && i.return_status !== 'RETURNED'
        if (statusFilter === 'returned') return i.return_status === 'RETURNED'
        return true
      })
      if (!hasMatch) return false
    }
    return true
  })

  // ═══ ASSIGN MACHINE ═══
  const [assignMachineId, setAssignMachineId] = useState('')
  const handleAssign = async () => {
    if (!assignMachineId) { showToast('Makine seçin', 'error'); return }
    setSaving(true)
    try {
      const machine = fleet.find(f => f.id === assignMachineId)
      await supabase.from('delivery_items').update({
        assigned_machine_id: assignMachineId,
        assigned_machine_serial: machine?.serial_number || '',
        assigned_machine_name: machine?.machines?.name || '',
        delivery_status: 'ASSIGNED'
      }).eq('id', assignModal.id)
      await supabase.from('fleet').update({ status: 'reserved' }).eq('id', assignMachineId)
      showToast('Makine atandı', 'success')
      setAssignModal(null)
      loadData()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
    setSaving(false)
  }

  // ═══ DELIVERY / RETURN PLAN ═══
  const [planForm, setPlanForm] = useState({ date: '', time: '09:00', driver_id: '', vehicle_plate: '', route_notes: '' })
  const openPlanModal = (item, type) => {
    setPlanForm({ date: '', time: '09:00', driver_id: '', vehicle_plate: '', route_notes: '' })
    setPlanModal({ item, type })
  }
  const handlePlan = async () => {
    if (!planForm.date) { showToast('Tarih seçin', 'error'); return }
    setSaving(true)
    try {
      const prefix = planModal.type === 'delivery' ? 'delivery' : 'return'
      const plannedDate = `${planForm.date}T${planForm.time || '09:00'}:00`
      const updateData = {
        [`${prefix}_planned_date`]: plannedDate,
        [`${prefix}_driver_id`]: planForm.driver_id || null,
        [`${prefix}_vehicle_plate`]: planForm.vehicle_plate || null,
        [`${prefix}_route_notes`]: planForm.route_notes || null,
        [`${prefix}_status`]: 'PLANNED',
      }
      await supabase.from('delivery_items').update(updateData).eq('id', planModal.item.id)
      showToast(planModal.type === 'delivery' ? 'Teslimat planlandı' : 'İade planlandı', 'success')
      setPlanModal(null)
      loadData()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
    setSaving(false)
  }

  // ═══ RENDER ═══
  if (loading) return <div className="p-6"><SkeletonCards count={4} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isCustomer ? 'Teslimatlarım' : 'Teslimatlar'}</h1>
          <p className="text-sm text-gray-500">{items.length} makine kalemi</p>
        </div>
        <Button variant="outline" icon={RefreshCw} onClick={loadData}>Yenile</Button>
      </div>

      {/* Stats - Staff Only */}
      {isAdmin && (
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Atanmadı', value: stats.unassigned, color: 'text-gray-600', bg: 'bg-gray-50' },
            { label: 'Atandı', value: stats.assigned, color: 'text-yellow-700', bg: 'bg-yellow-50' },
            { label: 'Planlandı', value: stats.planned, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Teslim', value: stats.delivered, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'İade Planlı', value: stats.returnPlanned, color: 'text-orange-700', bg: 'bg-orange-50' },
            { label: 'İade Edildi', value: stats.returned, color: 'text-purple-700', bg: 'bg-purple-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Teklif no, müşteri, makine ara..." className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
          <option value="all">Tüm Durumlar</option>
          <option value="unassigned">Atanmadı</option>
          <option value="planned">Planlandı</option>
          <option value="delivered">Teslim Edildi</option>
          <option value="returned">İade Edildi</option>
        </select>
      </div>

      {/* Grouped Items */}
      {filteredGroups.length === 0 ? (
        <EmptyState icon={Truck} title="Teslimat bulunamadı" description={isCustomer ? 'Onaylanan teklifleriniz burada görünecek.' : 'Kriterlere uygun teslimat yok.'} />
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(([pid, groupItems]) => {
            const proposal = getProposal(pid)
            const proposalNo = proposal?.proposal_number || '—'
            const customerName = getCustomerName(proposal?.company_id)
            const isExpanded = expandedProposal === pid
            const deliveredCount = groupItems.filter(i => i.delivery_status === 'DELIVERED').length
            const returnedCount = groupItems.filter(i => i.return_status === 'RETURNED').length
            const allDone = groupItems.length > 0 && groupItems.every(i => i.return_status === 'RETURNED')

            return (
              <Card key={pid} className="overflow-hidden" style={{ borderLeft: `4px solid ${allDone ? '#9ca3af' : '#3b82f6'}` }}>
                {/* Group Header */}
                <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedProposal(isExpanded ? null : pid)}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900">{proposalNo}</h3>
                        {isAdmin && <span className="text-sm text-gray-500 flex items-center gap-1"><Building className="w-4 h-4" />{customerName}</span>}
                        {allDone && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Tamamlandı</span>}
                      </div>
                      <div className="flex gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1"><Package className="w-4 h-4" />{groupItems.length} makine</span>
                        {deliveredCount > 0 && <span className="text-emerald-600">{deliveredCount} teslim</span>}
                        {returnedCount > 0 && <span className="text-orange-600">{returnedCount} iade</span>}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded Items */}
                {isExpanded && (
                  <div className="border-t bg-gray-50/50 divide-y divide-gray-100">
                    {groupItems.map((item, idx) => {
                      const dFlow = DELIVERY_FLOW[item.delivery_status] || DELIVERY_FLOW.UNASSIGNED
                      const rFlow = RETURN_FLOW[item.return_status] || RETURN_FLOW.NONE
                      const DIcon = dFlow.icon || Package

                      return (
                        <div key={item.id} className="p-4">
                          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                            {/* Item Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                                <h4 className="font-semibold text-gray-900">{item.machine_type}</h4>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${dFlow.color}`}>
                                  <DIcon className="w-3 h-3" />{isCustomer ? dFlow.customer : dFlow.label}
                                </span>
                                {item.return_status && item.return_status !== 'NONE' && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rFlow.color}`}>
                                    {isCustomer ? (rFlow.customer || rFlow.label) : rFlow.label}
                                  </span>
                                )}
                              </div>

                              {/* Details Row */}
                              <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                                <span>{item.duration} {item.period}</span>
                                {item.assigned_machine_serial && (
                                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">SN: {item.assigned_machine_serial}</span>
                                )}
                                {item.assigned_machine_name && !isCustomer && (
                                  <span className="text-xs text-gray-500">{item.assigned_machine_name}</span>
                                )}
                              </div>

                              {/* Dates */}
                              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                                {item.delivery_planned_date && (
                                  <span className="flex items-center gap-1 text-blue-600">
                                    <Calendar className="w-3 h-3" />Teslimat: {new Date(item.delivery_planned_date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                {item.delivery_completed_at && (
                                  <span className="flex items-center gap-1 text-emerald-600">
                                    <CheckCircle className="w-3 h-3" />Teslim: {new Date(item.delivery_completed_at).toLocaleDateString('tr-TR')}
                                  </span>
                                )}
                                {item.return_planned_date && (
                                  <span className="flex items-center gap-1 text-orange-600">
                                    <Calendar className="w-3 h-3" />İade: {new Date(item.return_planned_date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                {item.return_completed_at && (
                                  <span className="flex items-center gap-1 text-purple-600">
                                    <CheckCircle className="w-3 h-3" />İade: {new Date(item.return_completed_at).toLocaleDateString('tr-TR')}
                                  </span>
                                )}
                              </div>

                              {/* Driver info (staff) */}
                              {isAdmin && (item.delivery_vehicle_plate || item.return_vehicle_plate) && (
                                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                                  {item.delivery_vehicle_plate && <span>🚛 Teslimat: {item.delivery_vehicle_plate}</span>}
                                  {item.return_vehicle_plate && <span>🚛 İade: {item.return_vehicle_plate}</span>}
                                </div>
                              )}

                              {/* Form PDF buttons - HEM MÜŞTERİ HEM ADMİN */}
                              {(item.delivery_completed_at || item.return_completed_at) && (
                                <div className="flex gap-2 mt-3 flex-wrap">
                                  {item.delivery_completed_at && (
                                    <>
                                      <button onClick={() => setViewModal({ item: { ...item, proposalNumber: proposalNo, customerName }, type: 'delivery' })} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 flex items-center gap-1.5 border border-emerald-200">
                                        <Eye className="w-3.5 h-3.5" />Teslimat Formu
                                      </button>
                                      {item.delivery_pdf_url && (
                                        <button onClick={() => window.open(fixStorageUrl(item.delivery_pdf_url), '_blank')} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-1.5 border border-blue-200">
                                          <Download className="w-3.5 h-3.5" />Teslimat PDF
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {item.return_completed_at && (
                                    <>
                                      <button onClick={() => setViewModal({ item: { ...item, proposalNumber: proposalNo, customerName }, type: 'return' })} className="text-xs px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 flex items-center gap-1.5 border border-orange-200">
                                        <Eye className="w-3.5 h-3.5" />İade Formu
                                      </button>
                                      {item.return_pdf_url && (
                                        <button onClick={() => window.open(fixStorageUrl(item.return_pdf_url), '_blank')} className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 flex items-center gap-1.5 border border-amber-200">
                                          <Download className="w-3.5 h-3.5" />İade PDF
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons - Staff Only */}
                            {isAdmin && (
                              <div className="flex flex-wrap gap-2 flex-shrink-0">
                                {item.delivery_status === 'UNASSIGNED' && (
                                  <Button size="sm" variant="primary" icon={Package} onClick={() => { setAssignMachineId(''); setAssignModal(item) }}>Makine Ata</Button>
                                )}
                                {item.delivery_status === 'ASSIGNED' && (
                                  <Button size="sm" variant="primary" icon={Calendar} onClick={() => openPlanModal(item, 'delivery')}>Teslimat Planla</Button>
                                )}
                                {item.delivery_status === 'PLANNED' && (
                                  <Button size="sm" variant="success" icon={ClipboardCheck} onClick={() => setFormModal({ item: { ...item, proposalNumber: proposalNo, customerName }, type: 'delivery' })}>Teslim Et</Button>
                                )}
                                {item.delivery_status === 'DELIVERED' && (!item.return_status || item.return_status === 'NONE') && (
                                  <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => openPlanModal(item, 'return')}>İade Planla</Button>
                                )}
                                {item.delivery_status === 'DELIVERED' && item.return_status === 'PLANNED' && (
                                  <Button size="sm" variant="warning" icon={ClipboardCheck} onClick={() => setFormModal({ item: { ...item, proposalNumber: proposalNo, customerName }, type: 'return' })}>İade Al</Button>
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

      {/* ═══ ASSIGN MACHINE MODAL ═══ */}
      <Modal isOpen={!!assignModal} onClose={() => setAssignModal(null)} title="Makine Ata" size="md">
        {assignModal && (
          <div className="p-6 space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold">{assignModal.machine_type}</p>
              <p className="text-sm text-gray-500">{assignModal.duration} {assignModal.period}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Müsait Makine *</label>
              <select value={assignMachineId} onChange={e => setAssignMachineId(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
                <option value="">Makine seçin...</option>
                {getAvailableFleet().map(m => (
                  <option key={m.id} value={m.id}>{m.serial_number} — {m.machines?.name || 'Makine'}</option>
                ))}
              </select>
              {getAvailableFleet().length === 0 && <p className="text-xs text-red-500 mt-1">Müsait makine bulunamadı</p>}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setAssignModal(null)}>İptal</Button>
              <Button variant="primary" className="flex-1" onClick={handleAssign} loading={saving}>Ata</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ PLAN MODAL (Delivery / Return) ═══ */}
      <Modal isOpen={!!planModal} onClose={() => setPlanModal(null)} title={planModal?.type === 'delivery' ? 'Teslimat Planla' : 'İade Planla'} size="md">
        {planModal && (
          <div className="p-6 space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold">{planModal.item.machine_type}</p>
              <p className="text-sm text-gray-500">{planModal.item.assigned_machine_serial && `SN: ${planModal.item.assigned_machine_serial}`}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Tarih *" type="date" value={planForm.date} onChange={e => setPlanForm(p => ({ ...p, date: e.target.value }))} />
              <Input label="Saat" type="time" value={planForm.time} onChange={e => setPlanForm(p => ({ ...p, time: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şoför / Operatör</label>
              <select value={planForm.driver_id} onChange={e => setPlanForm(p => ({ ...p, driver_id: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
                <option value="">Seçin...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.role})</option>)}
              </select>
            </div>
            <Input label="Araç Plakası" value={planForm.vehicle_plate} onChange={e => setPlanForm(p => ({ ...p, vehicle_plate: e.target.value }))} placeholder="34 XX 1234" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rota / Notlar</label>
              <textarea rows={2} value={planForm.route_notes} onChange={e => setPlanForm(p => ({ ...p, route_notes: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none" placeholder="Adres, yol tarifi, özel bilgi..." />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPlanModal(null)}>İptal</Button>
              <Button variant="primary" className="flex-1" onClick={handlePlan} loading={saving}>{planModal.type === 'delivery' ? 'Teslimatı Planla' : 'İadeyi Planla'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ DELIVERY / RETURN FORM MODAL ═══ */}
      <Modal isOpen={!!formModal} onClose={() => setFormModal(null)} title={formModal?.type === 'delivery' ? '📦 Teslimat Formu' : '🔄 İade Formu'} size="lg">
        {formModal && (
          <DeliveryReturnFormInline
            item={formModal.item}
            type={formModal.type}
            user={user}
            showToast={showToast}
            onComplete={() => { setFormModal(null); loadData() }}
            onClose={() => setFormModal(null)}
          />
        )}
      </Modal>

      {/* ═══ VIEW FORM MODAL ═══ */}
      <Modal isOpen={!!viewModal} onClose={() => setViewModal(null)} title={viewModal?.type === 'delivery' ? '📄 Teslimat Formu' : '📄 İade Formu'} size="lg">
        {viewModal && (
          <FormViewerInline
            item={viewModal.item}
            type={viewModal.type}
            onClose={() => setViewModal(null)}
          />
        )}
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DELIVERY / RETURN FORM (Inline Component)
// Auto-fills: date, GPS, serial, machine type, proposal, customer
// Manual: hour meter, fuel, conditions, photos (15), signature, person name
// ═══════════════════════════════════════════════════════════════
const DeliveryReturnFormInline = ({ item, type, user, showToast, onComplete, onClose }) => {
  const isDelivery = type === 'delivery'
  const prefix = isDelivery ? 'delivery' : 'return'

  const [form, setForm] = useState({
    hour_meter: '', fuel_level: 50, person_name: '', notes: '',
    conditions: [], condition_notes: ''
  })
  const [photos, setPhotos] = useState([])
  const [photoFiles, setPhotoFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [gps, setGps] = useState({ lat: null, lng: null, loading: true, error: null })
  const [showCondDD, setShowCondDD] = useState(false)
  const condRef = useRef(null)

  // Signature
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  // GPS
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, loading: false, error: null }),
        () => setGps({ lat: null, lng: null, loading: false, error: 'Konum alınamadı' }),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    } else { setGps({ lat: null, lng: null, loading: false, error: 'GPS desteklenmiyor' }) }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (condRef.current && !condRef.current.contains(e.target)) setShowCondDD(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Canvas setup
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect()
    const sx = canvas.width / r.width, sy = canvas.height / r.height
    if (e.touches) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy }
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }
  }
  const startDraw = (e) => { e.preventDefault(); const c = canvasRef.current; const ctx = c.getContext('2d'); const p = getPos(e, c); ctx.beginPath(); ctx.moveTo(p.x, p.y); setIsDrawing(true) }
  const moveDraw = (e) => { if (!isDrawing) return; e.preventDefault(); const c = canvasRef.current; const ctx = c.getContext('2d'); const p = getPos(e, c); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSignature(true) }
  const stopDraw = () => setIsDrawing(false)
  const clearSig = () => { const c = canvasRef.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setHasSignature(false) }

  const toggleCondition = (cond) => {
    setForm(prev => {
      const has = prev.conditions.includes(cond)
      let next = has ? prev.conditions.filter(c => c !== cond) : [...prev.conditions, cond]
      if (cond === 'HASAR YOK' && !has) next = ['HASAR YOK']
      else if (cond !== 'HASAR YOK' && !has) next = next.filter(c => c !== 'HASAR YOK')
      return { ...prev, conditions: next }
    })
  }

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = 15 - photos.length
    if (remaining <= 0) { showToast('En fazla 15 fotoğraf yüklenebilir', 'error'); return }
    const toAdd = files.slice(0, remaining)
    setPhotos(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))])
    setPhotoFiles(prev => [...prev, ...toAdd])
    if (files.length > remaining) showToast(`${files.length - remaining} fotoğraf limit aşımı nedeniyle eklenmedi`, 'error')
  }
  const removePhoto = (i) => { setPhotos(prev => prev.filter((_, x) => x !== i)); setPhotoFiles(prev => prev.filter((_, x) => x !== i)) }

  const handleSubmit = async () => {
    if (!form.hour_meter) { showToast('Sayaç değeri zorunlu', 'error'); return }
    if (!form.person_name.trim()) { showToast(isDelivery ? 'Teslim alan kişi adı zorunlu' : 'İade eden kişi adı zorunlu', 'error'); return }
    if (form.conditions.length === 0) { showToast('Makine genel durumu seçiniz', 'error'); return }
    setSaving(true)
    try {
      // Upload photos
      const photoUrls = []
      for (let i = 0; i < photoFiles.length; i++) {
        const file = photoFiles[i]
        const blob = await compressImageToBlob(file, 1200, 0.7) || file
        const ext = blob.type === 'image/jpeg' ? 'jpg' : file.name?.split('.').pop() || 'jpg'
        const fileName = `${prefix}/${item.id}/${Date.now()}_${i}.${ext}`
        const { error: upErr } = await supabase.storage.from('rentals').upload(fileName, blob, { contentType: blob.type || 'image/jpeg', upsert: true })
        if (upErr) { showToast(`Fotoğraf ${i + 1} yüklenemedi`, 'error'); setSaving(false); return }
        const { data: u } = supabase.storage.from('rentals').getPublicUrl(fileName)
        photoUrls.push(u.publicUrl)
      }
      // Upload signature
      let signatureUrl = null
      if (hasSignature && canvasRef.current) {
        const sigBlob = await new Promise(r => canvasRef.current.toBlob(r, 'image/png'))
        if (sigBlob) {
          const sigName = `${prefix}/${item.id}/signature_${Date.now()}.png`
          const { error: sigErr } = await supabase.storage.from('rentals').upload(sigName, sigBlob, { contentType: 'image/png', upsert: true })
          if (sigErr) { showToast('İmza yüklenemedi', 'error'); setSaving(false); return }
          const { data: su } = supabase.storage.from('rentals').getPublicUrl(sigName)
          signatureUrl = su.publicUrl
        }
      }
      // Update DB
      const updateData = {
        [`${prefix}_hour_meter`]: parseFloat(form.hour_meter),
        [`${prefix}_fuel_level`]: form.fuel_level,
        [`${prefix}_person_name`]: form.person_name.trim(),
        [`${prefix}_notes`]: form.notes.trim() || null,
        [`${prefix}_photos`]: photoUrls,
        [`${prefix}_signature_url`]: signatureUrl,
        [`${prefix}_completed_at`]: new Date().toISOString(),
        [`${prefix}_completed_by`]: user.id,
        [`${prefix}_status`]: isDelivery ? 'DELIVERED' : 'RETURNED',
        [`${prefix}_conditions`]: form.conditions,
        [`${prefix}_condition_notes`]: form.condition_notes.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (gps.lat && gps.lng) { updateData[`${prefix}_lat`] = gps.lat; updateData[`${prefix}_lng`] = gps.lng }
      const { error: dbErr } = await supabase.from('delivery_items').update(updateData).eq('id', item.id)
      if (dbErr) { showToast('Kayıt hatası: ' + dbErr.message, 'error'); setSaving(false); return }
      // Fleet status
      if (item.assigned_machine_id) {
        await supabase.from('fleet').update({ status: isDelivery ? 'RENTED' : 'AVAILABLE' }).eq('id', item.assigned_machine_id)
      }
      showToast(isDelivery ? 'Teslimat tamamlandı!' : 'İade tamamlandı!', 'success')
      onComplete()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
    setSaving(false)
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
      {/* Auto-filled Header */}
      <div className={`rounded-xl p-4 ${isDelivery ? 'bg-blue-50 border border-blue-200' : 'bg-orange-50 border border-orange-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isDelivery ? 'bg-blue-200 text-blue-800' : 'bg-orange-200 text-orange-800'}`}>
            {isDelivery ? '📦 TESLİMAT' : '🔄 İADE'}
          </span>
          <span className="text-xs text-gray-500">{new Date().toLocaleString('tr-TR')}</span>
        </div>
        <h4 className="font-bold text-gray-900 text-lg">{item.machine_type}</h4>
        <div className="flex flex-wrap gap-2 mt-2 text-xs">
          {item.assigned_machine_serial && <span className="bg-white px-2.5 py-1 rounded-lg border font-mono">SN: {item.assigned_machine_serial}</span>}
          {item.assigned_machine_name && <span className="bg-white px-2.5 py-1 rounded-lg border">{item.assigned_machine_name}</span>}
          {item.proposalNumber && <span className="bg-white px-2.5 py-1 rounded-lg border">📋 {item.proposalNumber}</span>}
          {item.customerName && <span className="bg-white px-2.5 py-1 rounded-lg border">🏢 {item.customerName}</span>}
        </div>
      </div>

      {/* GPS */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border">
        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {gps.loading ? <span className="text-xs text-gray-400 animate-pulse">Konum alınıyor...</span>
          : gps.error ? <span className="text-xs text-amber-600">⚠️ {gps.error}</span>
          : <span className="text-xs text-gray-600 font-mono">{gps.lat?.toFixed(6)}, {gps.lng?.toFixed(6)}</span>}
      </div>

      {/* Sayaç & Yakıt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1"><Gauge className="w-4 h-4" />Sayaç Değeri (Saat) *</label>
          <input type="number" step="0.1" value={form.hour_meter} onChange={e => setForm({ ...form, hour_meter: e.target.value })} placeholder="Örn: 1250.5" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1"><Fuel className="w-4 h-4" />Yakıt: <span className="font-bold text-amber-600">%{form.fuel_level}</span></label>
          <input type="range" min="0" max="100" step="5" value={form.fuel_level} onChange={e => setForm({ ...form, fuel_level: parseInt(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500 mt-2" />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>Boş</span><span>¼</span><span>½</span><span>¾</span><span>Dolu</span></div>
        </div>
      </div>

      {/* Teslim Alan / İade Eden */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1"><User className="w-4 h-4" />{isDelivery ? 'Teslim Alan Kişi *' : 'İade Eden Kişi *'}</label>
        <input value={form.person_name} onChange={e => setForm({ ...form, person_name: e.target.value })} placeholder="Ad Soyad" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
      </div>

      {/* Makine Durumu */}
      <div ref={condRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Makine Genel Durumu *</label>
        <div className="relative">
          <button type="button" onClick={() => setShowCondDD(!showCondDD)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left text-sm flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-200">
            <span className={form.conditions.length > 0 ? 'text-gray-900' : 'text-gray-400'}>
              {form.conditions.length > 0 ? `${form.conditions.length} durum seçildi` : 'Durum seçiniz...'}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCondDD ? 'rotate-180' : ''}`} />
          </button>
          {showCondDD && (
            <div className="absolute z-20 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-xl max-h-60 overflow-y-auto">
              {MACHINE_CONDITIONS.map(cond => {
                const sel = form.conditions.includes(cond)
                const isOk = cond === 'HASAR YOK'
                return (
                  <button key={cond} type="button" onClick={() => toggleCondition(cond)}
                    className={`w-full px-4 py-2.5 text-sm text-left flex items-center gap-3 hover:bg-gray-50 ${sel ? (isOk ? 'bg-emerald-50' : 'bg-amber-50') : ''}`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${sel ? (isOk ? 'bg-emerald-500 border-emerald-500' : 'bg-amber-500 border-amber-500') : 'border-gray-300'}`}>
                      {sel && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={sel ? 'font-medium' : ''}>{cond}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {form.conditions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.conditions.map(c => (
              <span key={c} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${c === 'HASAR YOK' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {c}<button type="button" onClick={() => toggleCondition(c)} className="hover:opacity-70">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Durum Detayı */}
      {form.conditions.some(c => c !== 'HASAR YOK') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Hasar / Durum Detayı <span className="text-red-500">*</span></label>
          <textarea rows={2} value={form.condition_notes} onChange={e => setForm({ ...form, condition_notes: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none" placeholder="Hasar detaylarını yazınız..." />
        </div>
      )}

      {/* Fotoğraflar (max 15) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1"><Camera className="w-4 h-4" />Fotoğraflar <span className="text-gray-400 font-normal">({photos.length}/15)</span></label>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-2">
          {photos.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => removePhoto(i)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
            </div>
          ))}
          {photos.length < 15 && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Camera className="w-5 h-5 text-gray-400 mb-0.5" />
              <span className="text-[10px] text-gray-400">Ekle</span>
              <input type="file" accept="image/*" multiple capture="environment" onChange={handlePhotoAdd} className="hidden" />
            </label>
          )}
        </div>
        <p className="text-xs text-gray-400">Makine genel görünüm, sayaç, hasar (varsa), teslim noktası</p>
      </div>

      {/* Notlar */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Ek Notlar</label>
        <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none" placeholder={isDelivery ? 'Teslimat ile ilgili notlar...' : 'İade ile ilgili notlar...'} />
      </div>

      {/* İmza */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-700">{isDelivery ? 'Teslim Alan İmzası' : 'İade Eden İmzası'}</label>
          {hasSignature && <button onClick={clearSig} className="text-xs text-red-500 hover:text-red-700 font-medium">Temizle</button>}
        </div>
        <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white" style={{ touchAction: 'none' }}>
          <canvas ref={canvasRef} width={500} height={150} style={{ width: '100%', height: '120px', display: 'block' }}
            onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={stopDraw} />
        </div>
        {!hasSignature && <p className="text-xs text-gray-400 mt-1">Yukarıdaki alana parmakla veya fareyle imza atın</p>}
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-3 border-t sticky bottom-0 bg-white pb-2">
        <Button variant="outline" onClick={onClose} className="flex-1">İptal</Button>
        <Button variant={isDelivery ? 'primary' : 'success'} onClick={handleSubmit} loading={saving} className="flex-1">
          {saving ? 'Kaydediliyor...' : isDelivery ? '✅ Teslimatı Tamamla' : '✅ İadeyi Tamamla'}
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// FORM VIEWER (Inline Component)
// View completed delivery/return form data + generate PDF
// ═══════════════════════════════════════════════════════════════
const FormViewerInline = ({ item, type, onClose }) => {
  const isDelivery = type === 'delivery'
  const prefix = isDelivery ? 'delivery' : 'return'
  const [printing, setPrinting] = useState(false)

  const d = {
    completedAt: item[`${prefix}_completed_at`],
    hourMeter: item[`${prefix}_hour_meter`],
    fuelLevel: item[`${prefix}_fuel_level`],
    personName: item[`${prefix}_person_name`],
    notes: item[`${prefix}_notes`],
    photos: item[`${prefix}_photos`] || [],
    signatureUrl: item[`${prefix}_signature_url`],
    lat: item[`${prefix}_lat`],
    lng: item[`${prefix}_lng`],
    conditions: item[`${prefix}_conditions`] || [],
    conditionNotes: item[`${prefix}_condition_notes`],
  }

  const resolveForPdf = async (url) => {
    if (!url) return ''
    if (url.startsWith('data:')) return url
    const fixedUrl = fixStorageUrl(url)
    try {
      const match = fixedUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^\/]+)\/(.+)$/)
      if (match) {
        const [, bucket, filePath] = match
        const { data, error } = await supabase.storage.from(bucket).download(filePath)
        if (!error && data) {
          return await new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.onerror = () => r(''); rd.readAsDataURL(data) })
        }
      }
      const resp = await fetch(fixedUrl, { mode: 'cors' })
      if (resp.ok) {
        const blob = await resp.blob()
        return await new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.onerror = () => r(''); rd.readAsDataURL(blob) })
      }
      return ''
    } catch { return '' }
  }

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const [sigB64, ...photoB64s] = await Promise.all([resolveForPdf(d.signatureUrl), ...d.photos.map(u => resolveForPdf(u))])
      const validPhotos = photoB64s.filter(Boolean)
      const photoGrid = validPhotos.length > 0 
        ? `<div class="section"><div class="section-title">FOTOĞRAFLAR</div><div class="photos">${validPhotos.map(b => `<img src="${b}"/>`).join('')}</div></div>` : ''
      const condBadges = d.conditions.length > 0 ? d.conditions.map(c => `<span class="badge ${c === 'HASAR YOK' ? 'badge-ok' : 'badge-warn'}">${c}</span>`).join(' ') : ''
      const logoHtml = `<img src="${LOGO_B64}" style="height:50px"/>`
      const sigHtml = sigB64 ? `<img src="${sigB64}"/>` : '<p style="padding:20px;color:#ccc">İmza yok</p>'
      const proposalNum = item.proposalNumber || '-'
      const companyName = item.customerName || '-'

      const html = `<!DOCTYPE html><html><head><title>${isDelivery ? 'Teslimat' : 'İade'} Formu</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;padding:30px;color:#333;font-size:13px}
.header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #C41E3A;padding-bottom:15px;margin-bottom:20px}
.header-left{display:flex;align-items:center;gap:12px}
.header-title{text-align:right}.header-title h1{font-size:20px;color:#0A1628;text-transform:uppercase;letter-spacing:1px;margin:0}.header-title p{font-size:11px;color:#6b7280;margin-top:2px}
.section{margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.section-title{font-weight:700;font-size:11px;color:#fff;background:#1a2744;padding:8px 14px;text-transform:uppercase;letter-spacing:0.5px}
.row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f3f4f6}.row:last-child{border:0}
.label{color:#6b7280;font-size:12px}.value{font-weight:600;text-align:right;font-size:12px}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin:2px 4px 2px 0}
.badge-ok{background:#d1fae5;color:#065f46}.badge-warn{background:#fef3c7;color:#92400e}
.photos{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:12px}.photos img{width:100%;height:200px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb}
.sig-section{padding:16px}.sig-box{border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#fafafa;text-align:center;max-width:300px}
.sig-box img{max-height:70px;margin-bottom:6px}.sig-box p{font-size:11px;color:#6b7280}.sig-box .name{font-weight:700;color:#1a2744;font-size:13px}
.footer{margin-top:24px;text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
.conditions-wrap{padding:10px 14px}.note-text{padding:10px 14px;font-size:12px;color:#374151;line-height:1.5}
@media print{body{padding:15px}.section{break-inside:avoid}}</style></head><body>
<div class="header"><div class="header-left">${logoHtml}</div>
<div class="header-title"><h1>${isDelivery ? 'TESLİMAT' : 'İADE'} FORMU</h1><p>${d.completedAt ? new Date(d.completedAt).toLocaleString('tr-TR') : ''}</p></div></div>
<div class="section"><div class="section-title">GENEL BİLGİLER</div>
<div class="row"><span class="label">Tarih</span><span class="value">${d.completedAt ? new Date(d.completedAt).toLocaleString('tr-TR') : '-'}</span></div>
<div class="row"><span class="label">Teklif No</span><span class="value">${proposalNum}</span></div>
<div class="row"><span class="label">Firma</span><span class="value">${companyName}</span></div>
<div class="row"><span class="label">${isDelivery ? 'Teslim Alan' : 'İade Eden'}</span><span class="value">${d.personName || '-'}</span></div>
${d.lat ? `<div class="row"><span class="label">Konum</span><span class="value">${Number(d.lat).toFixed(6)}, ${Number(d.lng).toFixed(6)}</span></div>` : ''}</div>
<div class="section"><div class="section-title">MAKİNE BİLGİLERİ</div>
<div class="row"><span class="label">Makine Tipi</span><span class="value">${item.machine_type || '-'}</span></div>
<div class="row"><span class="label">Atanan Makine</span><span class="value">${item.assigned_machine_name || '-'}</span></div>
<div class="row"><span class="label">Seri No</span><span class="value">${item.assigned_machine_serial || '-'}</span></div>
<div class="row"><span class="label">Sayaç</span><span class="value">${d.hourMeter || '-'} saat</span></div>
<div class="row"><span class="label">Yakıt Seviyesi</span><span class="value">%${d.fuelLevel ?? '-'}</span></div></div>
<div class="section"><div class="section-title">MAKİNE DURUMU</div>
<div class="conditions-wrap">${condBadges || '<span class="badge badge-ok">Belirtilmedi</span>'}</div>
${d.conditionNotes ? `<div class="note-text" style="border-top:1px solid #f3f4f6"><strong>Detay:</strong> ${d.conditionNotes}</div>` : ''}</div>
${d.notes ? `<div class="section"><div class="section-title">NOTLAR</div><div class="note-text">${d.notes}</div></div>` : ''}
${photoGrid}
<div class="section"><div class="section-title">İMZA</div><div class="sig-section">
<div class="sig-box">${sigHtml}<p class="name">${d.personName || '-'}</p><p>${isDelivery ? 'Teslim Alan' : 'İade Eden'}</p></div></div></div>
<div class="footer"><p>Bu form RENTH Portal üzerinden otomatik oluşturulmuştur.</p><p>${new Date().toLocaleString('tr-TR')}</p></div>
</body></html>`
      openPdfContent(html)
    } catch (err) { console.error('PDF error:', err) }
    setPrinting(false)
  }

  const fmtDate = (dt) => dt ? new Date(dt).toLocaleString('tr-TR') : '—'

  return (
    <div className="p-4 lg:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className={`rounded-xl p-4 ${isDelivery ? 'bg-blue-50 border border-blue-200' : 'bg-orange-50 border border-orange-200'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isDelivery ? 'bg-blue-200 text-blue-800' : 'bg-orange-200 text-orange-800'}`}>
            {isDelivery ? '📦 TESLİMAT FORMU' : '🔄 İADE FORMU'}
          </span>
        </div>
        <h4 className="font-bold text-gray-900">{item.machine_type}</h4>
        <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
          {item.assigned_machine_serial && <span className="font-mono">SN: {item.assigned_machine_serial}</span>}
          {item.assigned_machine_name && <span>• {item.assigned_machine_name}</span>}
        </div>
        <div className="flex flex-wrap gap-2 mt-2 text-xs">
          {item.proposalNumber && <span className="bg-white px-2 py-0.5 rounded border">📋 {item.proposalNumber}</span>}
          {item.customerName && <span className="bg-white px-2 py-0.5 rounded border">🏢 {item.customerName}</span>}
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border divide-y divide-gray-100">
        <div className="flex justify-between px-4 py-3"><span className="text-sm text-gray-500">Tarih</span><span className="text-sm font-medium">{fmtDate(d.completedAt)}</span></div>
        <div className="flex justify-between px-4 py-3"><span className="text-sm text-gray-500">{isDelivery ? 'Teslim Alan' : 'İade Eden'}</span><span className="text-sm font-medium">{d.personName || '—'}</span></div>
        <div className="flex justify-between px-4 py-3"><span className="text-sm text-gray-500">Sayaç</span><span className="text-sm font-medium">{d.hourMeter ? `${d.hourMeter} saat` : '—'}</span></div>
        <div className="flex justify-between px-4 py-3"><span className="text-sm text-gray-500">Yakıt</span><span className="text-sm font-medium">%{d.fuelLevel ?? '—'}</span></div>
        {d.lat && <div className="flex justify-between px-4 py-3"><span className="text-sm text-gray-500">Konum</span><span className="text-sm font-medium font-mono">{Number(d.lat).toFixed(6)}, {Number(d.lng).toFixed(6)}</span></div>}
      </div>

      {/* Conditions */}
      {d.conditions.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Makine Durumu</p>
          <div className="flex flex-wrap gap-1.5">
            {d.conditions.map((c, i) => (
              <span key={i} className={`text-xs font-medium px-2.5 py-1 rounded-full ${c === 'HASAR YOK' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{c}</span>
            ))}
          </div>
          {d.conditionNotes && <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-3 border">{d.conditionNotes}</p>}
        </div>
      )}

      {/* Notes */}
      {d.notes && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Notlar</p>
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border">{d.notes}</p>
        </div>
      )}

      {/* Photos */}
      {d.photos.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Fotoğraflar ({d.photos.length})</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {d.photos.map((url, i) => (
              <a key={i} href={resolveImageSrc(url)} target="_blank" rel="noopener" className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity">
                <img src={resolveImageSrc(url)} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Signature */}
      {d.signatureUrl && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">İmza</p>
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 inline-block">
            <img src={resolveImageSrc(d.signatureUrl)} alt="İmza" className="h-16" />
            <p className="text-xs text-gray-500 mt-1 font-medium">{d.personName}</p>
            <p className="text-[10px] text-gray-400">{isDelivery ? 'Teslim Alan' : 'İade Eden'}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-3 border-t sticky bottom-0 bg-white pb-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Kapat</Button>
        <Button variant="primary" icon={Download} onClick={handlePrint} loading={printing} className="flex-1">
          {printing ? 'Hazırlanıyor...' : 'Yazdır / PDF'}
        </Button>
      </div>
    </div>
  )
}

export default RentalsPage
