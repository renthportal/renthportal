'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase, fixStorageUrl } from '@/lib/supabase'
import {
  FolderKanban, Package, Calendar, Building, Clock, CheckCircle, 
  Truck, Wrench, FileText, ChevronDown, ChevronUp, RefreshCw, 
  Plus, ArrowRight, Timer, AlertTriangle, RotateCcw,
  Download, ClipboardList, FileSignature
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import Input from '@/components/ui/Input'
import SearchBar from '@/components/ui/SearchBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCards } from '@/components/ui/Skeleton'

const ProjectsPage = ({ user, showToast, isAdmin, setActivePage }) => {
  const [projects, setProjects] = useState([])
  const [customers, setCustomers] = useState([])
  const [deliveryItems, setDeliveryItems] = useState([])
  const [fleet, setFleet] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [serviceForm, setServiceForm] = useState({ delivery_item_id: '', description: '', type: 'breakdown', priority: 'normal' })
  const [extensionForm, setExtensionForm] = useState({ delivery_item_id: '', additional_days: 7, reason: '' })
  const [assignForm, setAssignForm] = useState({ machine_id: '' })
  const [saving, setSaving] = useState(false)

  const isCustomer = !isAdmin

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: custData } = await supabase.from('customers').select('id, company_name')
      setCustomers(custData || [])

      let query = supabase.from('proposals').select('*')
        .eq('status', 'CONVERTED')
        .order('created_at', { ascending: false })
      if (isCustomer && user?.company_id) {
        query = query.eq('company_id', user.company_id)
      }
      const { data: projectsData } = await query
      setProjects(projectsData || [])

      let diQuery = supabase.from('delivery_items').select('*').order('item_index')
      if (isCustomer && user?.company_id) {
        diQuery = diQuery.eq('company_id', user.company_id)
      }
      const { data: deliveryData } = await diQuery
      setDeliveryItems(deliveryData || [])

      if (isAdmin) {
        const { data: fleetData } = await supabase
          .from('fleet')
          .select('id, serial_number, status, machine_id, machines(id, name)')
          .order('serial_number')
        setFleet(fleetData || [])
      }
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
  }, [isCustomer, isAdmin, user])

  useEffect(() => { loadData() }, [loadData])

  const getCustomerName = (cid) => customers.find(c => c.id === cid)?.company_name || '-'
  const getProjectItems = (proposalId) => deliveryItems.filter(d => d.proposal_id === proposalId)

  const getDaysRunning = (item) => {
    if (!item.delivery_completed_at) return null
    return Math.max(0, Math.ceil((new Date() - new Date(item.delivery_completed_at)) / (1000 * 60 * 60 * 24)))
  }

  const getDaysRemaining = (item) => {
    if (!item.estimated_end) return null
    return Math.ceil((new Date(item.estimated_end) - new Date()) / (1000 * 60 * 60 * 24))
  }

  const getStatusInfo = (project) => {
    const items = getProjectItems(project.id)
    const allReturned = items.length > 0 && items.every(i => i.return_status === 'RETURNED')
    const allDelivered = items.length > 0 && items.every(i => i.delivery_status === 'DELIVERED')
    const hasExpired = items.some(i => i.estimated_end && new Date(i.estimated_end) < new Date())
    
    if (allReturned) return { label: 'Tamamlandı', color: 'bg-gray-100 text-gray-700', border: '#9ca3af' }
    if (hasExpired) return { label: 'Süre Doldu', color: 'bg-red-100 text-red-700', border: '#ef4444' }
    if (allDelivered) return { label: 'Aktif', color: 'bg-emerald-100 text-emerald-700', border: '#10b981' }
    return { label: 'Hazırlanıyor', color: 'bg-blue-100 text-blue-700', border: '#3b82f6' }
  }

  const getDeliveryBadge = (status) => {
    const map = {
      'UNASSIGNED': { label: isCustomer ? 'Hazırlanıyor' : 'Makine Atanmadı', color: 'bg-gray-100 text-gray-700', icon: Clock },
      'ASSIGNED': { label: isCustomer ? 'Hazırlanıyor' : 'Makine Atandı', color: 'bg-yellow-100 text-yellow-700', icon: Package },
      'PLANNED': { label: isCustomer ? 'Teslimat Planlandı' : 'Planlandı', color: 'bg-blue-100 text-blue-700', icon: Calendar },
      'IN_TRANSIT': { label: 'Yolda', color: 'bg-purple-100 text-purple-700', icon: Truck },
      'DELIVERED': { label: 'Teslim Edildi', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle }
    }
    return map[status] || { label: status || '-', color: 'bg-gray-100 text-gray-700', icon: Clock }
  }

  const getReturnBadge = (status) => {
    const map = {
      'NONE': { label: '—', color: 'bg-gray-50 text-gray-400' },
      'PLANNED': { label: 'İade Planlandı', color: 'bg-orange-100 text-orange-700' },
      'IN_TRANSIT': { label: 'İade Yolda', color: 'bg-blue-100 text-blue-700' },
      'RETURNED': { label: 'İade Edildi', color: 'bg-emerald-100 text-emerald-700' }
    }
    return map[status] || { label: '—', color: 'bg-gray-50 text-gray-400' }
  }

  const getAvailableMachines = () => {
    return fleet.filter(f => {
      const s = (f.status || '').toLowerCase()
      return s === 'available' || s === 'müsait'
    })
  }

  // ─── Service Request ───
  const openServiceModal = (project) => {
    setSelectedProject(project)
    const items = getProjectItems(project.id)
    setServiceForm({ delivery_item_id: items.length === 1 ? items[0].id : '', description: '', type: 'breakdown', priority: 'normal' })
    setShowServiceModal(true)
  }

  const handleCreateService = async () => {
    if (!serviceForm.delivery_item_id) { showToast('Makine seçin', 'error'); return }
    if (!serviceForm.description) { showToast('Açıklama zorunlu', 'error'); return }
    setSaving(true)
    try {
      const typeLabels = { breakdown: 'Arıza', maintenance: 'Bakım', inspection: 'Kontrol', scheduled: 'Planlı Bakım' }
      const selectedDI = deliveryItems.find(d => d.id === serviceForm.delivery_item_id)
      const title = `${typeLabels[serviceForm.type] || 'Talep'} - ${selectedDI?.machine_type || ''} - ${selectedProject.proposal_number}`
      
      await supabase.from('service_requests').insert({
        title,
        company_id: selectedProject.company_id,
        proposal_id: selectedProject.id,
        delivery_item_id: serviceForm.delivery_item_id,
        fleet_id: selectedDI?.assigned_machine_id || null,
        type: serviceForm.type,
        priority: serviceForm.priority,
        description: serviceForm.description,
        status: 'pending'
      })
      
      showToast('Servis talebi oluşturuldu', 'success')
      setShowServiceModal(false)
      loadData()
    } catch (err) {
      showToast('Talep oluşturulamadı: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // ─── Extension Request ───
  const openExtensionModal = (project) => {
    setSelectedProject(project)
    const items = getProjectItems(project.id)
    setExtensionForm({ delivery_item_id: items.length === 1 ? items[0].id : '', additional_days: 7, reason: '' })
    setShowExtensionModal(true)
  }

  const handleCreateExtension = async () => {
    if (!extensionForm.delivery_item_id) { showToast('Makine seçin', 'error'); return }
    if (!extensionForm.reason) { showToast('Sebep zorunlu', 'error'); return }
    setSaving(true)
    try {
      const selectedDI = deliveryItems.find(d => d.id === extensionForm.delivery_item_id)
      await supabase.from('extensions').insert({
        proposal_id: selectedProject.id,
        company_id: selectedProject.company_id,
        delivery_item_id: extensionForm.delivery_item_id,
        machine_type: selectedDI?.machine_type || '',
        additional_days: extensionForm.additional_days,
        reason: extensionForm.reason,
        status: 'PENDING'
      })
      showToast('Süre uzatma talebi oluşturuldu', 'success')
      setShowExtensionModal(false)
      loadData()
    } catch (err) {
      showToast('Talep oluşturulamadı: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // ─── Assign Machine (Staff) ───
  const openAssignModal = (project, item) => {
    setSelectedProject(project)
    setSelectedItem(item)
    setAssignForm({ machine_id: item.assigned_machine_id || '' })
    setShowAssignModal(true)
  }

  const handleAssignMachine = async () => {
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

  // ─── Filters ───
  const filteredProjects = projects.filter(p => {
    if (statusFilter !== 'all') {
      const si = getStatusInfo(p)
      if (statusFilter === 'active' && si.label !== 'Aktif' && si.label !== 'Hazırlanıyor') return false
      if (statusFilter === 'completed' && si.label !== 'Tamamlandı') return false
      if (statusFilter === 'expired' && si.label !== 'Süre Doldu') return false
    }
    if (search) {
      const s = search.toLowerCase()
      return p.proposal_number?.toLowerCase().includes(s) || getCustomerName(p.company_id).toLowerCase().includes(s)
    }
    return true
  })

  // Helper: machine select options for a project
  const getMachineOptions = (project) => {
    return getProjectItems(project.id).map(item => ({
      id: item.id,
      label: `${item.machine_type}${item.assigned_machine_serial ? ` (SN: ${item.assigned_machine_serial})` : ''}`
    }))
  }

  if (loading) return <div className="p-6"><SkeletonCards count={4} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isCustomer ? 'Projelerim' : 'Proje Takip'}</h1>
          <p className="text-sm text-gray-500">{projects.length} proje</p>
        </div>
        <Button variant="outline" icon={RefreshCw} onClick={loadData}>Yenile</Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Teklif no, müşteri ara..." className="flex-1 max-w-md" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
          <option value="all">Tüm Durumlar</option>
          <option value="active">Aktif</option>
          <option value="completed">Tamamlandı</option>
          <option value="expired">Süre Doldu</option>
        </select>
      </div>

      {filteredProjects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Proje bulunamadı" description={isCustomer ? "Henüz aktif projeniz yok. Teklifiniz onaylandıktan sonra burada görünecektir." : "Kriterlere uygun proje yok."} />
      ) : (
        <div className="space-y-4">
          {filteredProjects.map(project => {
            const status = getStatusInfo(project)
            const items = getProjectItems(project.id)
            const isExpanded = expandedId === project.id
            
            const deliveredCount = items.filter(i => i.delivery_status === 'DELIVERED').length
            const returnedCount = items.filter(i => i.return_status === 'RETURNED').length
            const totalMachines = items.length

            const startDates = items.filter(i => i.estimated_start).map(i => new Date(i.estimated_start))
            const endDates = items.filter(i => i.estimated_end).map(i => new Date(i.estimated_end))
            const earliestStart = startDates.length > 0 ? new Date(Math.min(...startDates)) : null
            const latestEnd = endDates.length > 0 ? new Date(Math.max(...endDates)) : null
            const daysToEnd = latestEnd ? Math.ceil((latestEnd - new Date()) / (1000 * 60 * 60 * 24)) : null

            return (
              <Card key={project.id} className="overflow-hidden" style={{ borderLeft: `4px solid ${status.border}` }}>
                <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(isExpanded ? null : project.id)}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900">{project.proposal_number}</h3>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>
                        {daysToEnd !== null && daysToEnd > 0 && daysToEnd <= 7 && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{daysToEnd} gün kaldı
                          </span>
                        )}
                        {daysToEnd !== null && daysToEnd <= 0 && status.label !== 'Tamamlandı' && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Süre doldu!</span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        {isAdmin && <span className="flex items-center gap-1"><Building className="w-4 h-4" />{getCustomerName(project.company_id)}</span>}
                        {earliestStart && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{earliestStart.toLocaleDateString('tr-TR')}</span>}
                        {latestEnd && <span className="flex items-center gap-1"><ArrowRight className="w-4 h-4" />{latestEnd.toLocaleDateString('tr-TR')}</span>}
                        <span className="flex items-center gap-1"><Package className="w-4 h-4" />{deliveredCount}/{totalMachines} teslim</span>
                        {returnedCount > 0 && <span className="flex items-center gap-1 text-orange-600"><RotateCcw className="w-4 h-4" />{returnedCount} iade</span>}
                        {!isCustomer && project.total_amount && (
                          <span className="font-medium text-gray-900">₺{Number(project.total_amount).toLocaleString('tr-TR')}</span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-6">

                    {/* ── İmzalı Sözleşme PDF ── */}
                    {project.signed_pdf_url && (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <FileSignature className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-blue-800 flex-1">İmzalı Sözleşme</span>
                        <button
                          onClick={() => window.open(fixStorageUrl(project.signed_pdf_url), '_blank')}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />İndir / Görüntüle
                        </button>
                      </div>
                    )}

                    {/* ── Makine Kalemleri ── */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><ClipboardList className="w-5 h-5" />Makine Kalemleri ({items.length})</h4>
                      {items.length === 0 ? (
                        <p className="text-sm text-gray-500 bg-white p-4 rounded-lg border">Henüz makine kalemi yok.</p>
                      ) : (
                        <div className="space-y-3">
                          {items.map((item, idx) => {
                            const dBadge = getDeliveryBadge(item.delivery_status)
                            const rBadge = getReturnBadge(item.return_status)
                            const DIcon = dBadge.icon
                            const daysRunning = getDaysRunning(item)
                            const daysRemaining = getDaysRemaining(item)

                            return (
                              <div key={item.id} className="bg-white rounded-xl border p-4">
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                                      <h5 className="font-semibold text-gray-900">{item.machine_type}</h5>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${dBadge.color}`}>
                                        <DIcon className="w-3 h-3" />{dBadge.label}
                                      </span>
                                      {item.return_status && item.return_status !== 'NONE' && (
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rBadge.color}`}>{rBadge.label}</span>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                      <span>{item.duration} {item.period}</span>
                                      {item.assigned_machine_serial && isAdmin && (
                                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">SN: {item.assigned_machine_serial}</span>
                                      )}
                                      {item.delivery_completed_at && (
                                        <span className="text-emerald-600 text-xs flex items-center gap-1">
                                          <CheckCircle className="w-3 h-3" />Teslim: {new Date(item.delivery_completed_at).toLocaleDateString('tr-TR')}
                                        </span>
                                      )}
                                      {item.return_completed_at && (
                                        <span className="text-orange-600 text-xs flex items-center gap-1">
                                          <RotateCcw className="w-3 h-3" />İade: {new Date(item.return_completed_at).toLocaleDateString('tr-TR')}
                                        </span>
                                      )}
                                    </div>

                                    {/* Days Running / Remaining */}
                                    {item.delivery_status === 'DELIVERED' && item.return_status !== 'RETURNED' && (
                                      <div className="flex gap-3 mt-2 flex-wrap">
                                        {daysRunning !== null && (
                                          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-1">
                                            <Timer className="w-3 h-3" />{daysRunning} gün çalışıyor
                                          </span>
                                        )}
                                        {daysRemaining !== null && (
                                          <span className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${daysRemaining <= 3 ? 'bg-red-50 text-red-700' : daysRemaining <= 7 ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                                            <Clock className="w-3 h-3" />{Math.max(daysRemaining, 0)} gün kaldı
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Teslimat / İade Form PDF'leri - HEM MÜŞTERİ HEM ADMİN */}
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                      {item.delivery_pdf_url && (
                                        <button onClick={(e) => { e.stopPropagation(); window.open(fixStorageUrl(item.delivery_pdf_url), '_blank') }} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
                                          <FileText className="w-3 h-3" />Teslimat Formu
                                        </button>
                                      )}
                                      {item.return_pdf_url && (
                                        <button onClick={(e) => { e.stopPropagation(); window.open(fixStorageUrl(item.return_pdf_url), '_blank') }} className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 flex items-center gap-1">
                                          <FileText className="w-3 h-3" />İade Formu
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Aksiyonlar */}
                                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                                    {isAdmin && item.delivery_status === 'UNASSIGNED' && (
                                      <Button size="sm" variant="primary" icon={Package} onClick={(e) => { e.stopPropagation(); openAssignModal(project, item) }}>
                                        Makine Ata
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── Alt Butonlar ── */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" icon={Clock} onClick={() => openExtensionModal(project)}>Süre Uzatma Talebi</Button>
                      <Button size="sm" variant="outline" icon={Wrench} onClick={() => openServiceModal(project)}>Servis Talebi</Button>
                      {isCustomer && <Button size="sm" variant="outline" icon={Plus} onClick={() => setActivePage && setActivePage('request')}>Yeni Makine Talebi</Button>}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ═══ Servis Talebi Modal ═══ */}
      <Modal isOpen={showServiceModal} onClose={() => setShowServiceModal(false)} title="Yeni Servis Talebi" size="md">
        <div className="p-6 space-y-4">
          {selectedProject && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold">{selectedProject.proposal_number}</p>
              {isAdmin && <p className="text-sm text-gray-500">{getCustomerName(selectedProject.company_id)}</p>}
            </div>
          )}
          {/* Makine Seçimi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Makine *</label>
            <select 
              value={serviceForm.delivery_item_id} 
              onChange={(e) => setServiceForm(p => ({ ...p, delivery_item_id: e.target.value }))} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Makine seçin...</option>
              {selectedProject && getMachineOptions(selectedProject).map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Talep Tipi</label>
              <select value={serviceForm.type} onChange={(e) => setServiceForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="breakdown">Arıza</option>
                <option value="maintenance">Bakım</option>
                <option value="scheduled">Planlı Bakım</option>
                <option value="inspection">Kontrol</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Öncelik</label>
              <select value={serviceForm.priority} onChange={(e) => setServiceForm(p => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="low">Düşük</option>
                <option value="normal">Normal</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </div>
          </div>
          <Textarea label="Açıklama *" value={serviceForm.description} onChange={(e) => setServiceForm(p => ({ ...p, description: e.target.value }))} placeholder="Sorunu veya talebi detaylı açıklayın..." rows={4} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowServiceModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleCreateService} loading={saving}>Talep Oluştur</Button>
          </div>
        </div>
      </Modal>

      {/* ═══ Süre Uzatma Modal ═══ */}
      <Modal isOpen={showExtensionModal} onClose={() => setShowExtensionModal(false)} title="Süre Uzatma Talebi" size="md">
        <div className="p-6 space-y-4">
          {selectedProject && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold">{selectedProject.proposal_number}</p>
              {isAdmin && <p className="text-sm text-gray-500">{getCustomerName(selectedProject.company_id)}</p>}
            </div>
          )}
          {/* Makine Seçimi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Makine *</label>
            <select 
              value={extensionForm.delivery_item_id} 
              onChange={(e) => setExtensionForm(p => ({ ...p, delivery_item_id: e.target.value }))} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Makine seçin...</option>
              {selectedProject && getMachineOptions(selectedProject).map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          <Input label="Ek Gün *" type="number" min={1} value={extensionForm.additional_days} onChange={(e) => setExtensionForm(p => ({ ...p, additional_days: parseInt(e.target.value) || 1 }))} />
          <Textarea label="Sebep *" value={extensionForm.reason} onChange={(e) => setExtensionForm(p => ({ ...p, reason: e.target.value }))} placeholder="Süre uzatma sebebinizi yazın..." rows={3} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowExtensionModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleCreateExtension} loading={saving}>Talep Gönder</Button>
          </div>
        </div>
      </Modal>

      {/* ═══ Makine Ata Modal (Staff) ═══ */}
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
                <option key={m.id} value={m.id}>
                  {m.serial_number} - {m.machines?.name || 'Makine'} [{m.status}]
                </option>
              ))}
            </select>
            {getAvailableMachines().length === 0 && (
              <p className="text-sm text-red-500 mt-1">Müsait makine bulunamadı</p>
            )}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">Makine atandıktan sonra Teslimatlar sayfasından teslimat planlanabilir.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowAssignModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleAssignMachine} loading={saving}>Ata</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ProjectsPage
