'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Wrench, Plus, Clock, CheckCircle, AlertCircle,
  Calendar, RefreshCw, ChevronRight, Building, Package
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import SearchBar from '@/components/ui/SearchBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCards } from '@/components/ui/Skeleton'

const ServicesPage = ({ user, showToast }) => {
  const [requests, setRequests] = useState([])
  const [customers, setCustomers] = useState([])
  const [fleet, setFleet] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [saving, setSaving] = useState(false)

  const isCustomer = user?.role === 'CUSTOMER'

  const [form, setForm] = useState({
    customer_id: '',
    fleet_id: '',
    type: 'breakdown',
    priority: 'normal',
    description: ''
  })

  const STATUS_OPTIONS = [
    { value: 'pending', label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    { value: 'in_progress', label: 'İşlemde', color: 'bg-blue-100 text-blue-700', icon: Wrench },
    { value: 'completed', label: 'Tamamlandı', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    { value: 'cancelled', label: 'İptal', color: 'bg-red-100 text-red-700', icon: AlertCircle }
  ]

  const TYPE_OPTIONS = [
    { value: 'breakdown', label: 'Arıza' },
    { value: 'maintenance', label: 'Bakım' },
    { value: 'scheduled', label: 'Planlı Bakım' },
    { value: 'inspection', label: 'Kontrol' },
    { value: 'other', label: 'Diğer' }
  ]

  const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Düşük', color: 'text-gray-600' },
    { value: 'normal', label: 'Normal', color: 'text-blue-600' },
    { value: 'high', label: 'Yüksek', color: 'text-orange-600' },
    { value: 'urgent', label: 'Acil', color: 'text-red-600' }
  ]

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Müşteriler (admin için)
      if (!isCustomer) {
        const { data: custs, error: custError } = await supabase
          .from('customers')
          .select('id, company_name')
          .eq('is_active', true)
          .order('company_name')
        
        console.log('Customers loaded:', custs, custError)
        setCustomers(custs || [])
      }

      // Filo (makineler)
      let fleetQuery = supabase
        .from('fleet')
        .select('id, serial_number, machine:machines(name), customer_id')
        .order('serial_number')
      
      // Müşteri ise sadece kendi makinelerini veya müsait makineleri göster
      if (isCustomer && user?.customer_id) {
        fleetQuery = fleetQuery.or(`customer_id.eq.${user.customer_id},customer_id.is.null`)
      }
      
      const { data: fleetData, error: fleetError } = await fleetQuery
      console.log('Fleet loaded:', fleetData, fleetError)
      setFleet(fleetData || [])

      // Servis talepleri
      let query = supabase
        .from('service_requests')
        .select(`
          *,
          customer:customers(id, company_name),
          fleet:fleet(id, serial_number, machine:machines(name))
        `)
        .order('created_at', { ascending: false })

      if (isCustomer && user?.customer_id) {
        query = query.eq('customer_id', user.customer_id)
      }

      const { data, error: reqError } = await query
      console.log('Requests loaded:', data, reqError)
      setRequests(data || [])
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
  }, [isCustomer, user])

  useEffect(() => { loadData() }, [loadData])

  // Müşteriye göre filo filtrele (admin için)
  const getFilteredFleet = () => {
    if (isCustomer) {
      // Müşteri: sadece kendi makineleri
      return fleet.filter(f => f.customer_id === user?.customer_id)
    } else if (form.customer_id) {
      // Admin: seçili müşterinin makineleri
      return fleet.filter(f => f.customer_id === form.customer_id)
    }
    return fleet
  }

  const filteredRequests = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (typeFilter !== 'all' && r.type !== typeFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return r.title?.toLowerCase().includes(s) ||
             r.description?.toLowerCase().includes(s) ||
             r.customer?.company_name?.toLowerCase().includes(s) ||
             r.fleet?.serial_number?.toLowerCase().includes(s)
    }
    return true
  })

  const openAddModal = () => {
    setSelectedRequest(null)
    setForm({
      customer_id: '',
      fleet_id: '',
      type: 'breakdown',
      priority: 'normal',
      description: ''
    })
    setShowModal(true)
  }

  const openDetailModal = (request) => {
    setSelectedRequest(request)
    setShowDetailModal(true)
  }

  const handleSave = async () => {
    if (!form.description) {
      showToast('Açıklama zorunlu', 'error')
      return
    }
    
    // Customer ID belirleme
    let customerId
    if (isCustomer) {
      customerId = user?.customer_id
    } else {
      customerId = form.customer_id
      if (!customerId) {
        showToast('Firma seçimi zorunlu', 'error')
        return
      }
    }

    setSaving(true)
    try {
      const typeLabel = TYPE_OPTIONS.find(t => t.value === form.type)?.label || 'Talep'
      const title = `${typeLabel} - ${new Date().toLocaleDateString('tr-TR')}`

      const payload = {
        title: title,
        customer_id: customerId,
        fleet_id: form.fleet_id || null,
        type: form.type,
        priority: form.priority,
        description: form.description,
        is_scheduled: form.type === 'scheduled',
        status: 'pending'
      }

      const { error } = await supabase.from('service_requests').insert(payload)
      if (error) throw error
      
      showToast('Talep oluşturuldu', 'success')
      setShowModal(false)
      loadData()
    } catch (err) {
      showToast('Talep oluşturulamadı: ' + err.message, 'error')
    }
    setSaving(false)
  }

  const updateStatus = async (request, newStatus) => {
    try {
      await supabase.from('service_requests').update({ status: newStatus }).eq('id', request.id)
      showToast('Durum güncellendi', 'success')
      loadData()
      setShowDetailModal(false)
    } catch (err) {
      showToast('Güncelleme başarısız', 'error')
    }
  }

  const StatusBadge = ({ status }) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status)
    if (!opt) return null
    const Icon = opt.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${opt.color}`}>
        <Icon className="w-3 h-3" />
        {opt.label}
      </span>
    )
  }

  if (loading) return <div className="p-6"><SkeletonCards count={4} /></div>

  const filteredFleetForModal = getFilteredFleet()

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Servis Talepleri</h1>
          <p className="text-sm text-gray-500">{requests.length} talep</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={loadData}>Yenile</Button>
          <Button icon={Plus} onClick={openAddModal}>Yeni Talep</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUS_OPTIONS.map(s => {
          const count = requests.filter(r => r.status === s.value).length
          const Icon = s.icon
          return (
            <Card key={s.value} className={`p-4 ${s.color} border-0`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm">{s.label}</p>
                </div>
                <Icon className="w-8 h-8 opacity-50" />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Talep ara..." className="flex-1" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg w-40"
          >
            <option value="all">Tüm Durumlar</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg w-40"
          >
            <option value="all">Tüm Tipler</option>
            {TYPE_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Request List */}
      {filteredRequests.length === 0 ? (
        <EmptyState icon={Wrench} title="Talep bulunamadı" />
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(request => {
            const typeOpt = TYPE_OPTIONS.find(t => t.value === request.type)
            const priorityOpt = PRIORITY_OPTIONS.find(p => p.value === request.priority)
            
            return (
              <Card key={request.id} className="p-4 cursor-pointer hover:shadow-md transition-all" onClick={() => openDetailModal(request)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{request.title}</h3>
                      <StatusBadge status={request.status} />
                      <span className={`text-xs font-medium ${priorityOpt?.color}`}>{priorityOpt?.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      {request.customer && (
                        <span className="flex items-center gap-1">
                          <Building className="w-4 h-4" />
                          {request.customer.company_name}
                        </span>
                      )}
                      {request.fleet && (
                        <span className="flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          {request.fleet.serial_number}
                          {request.fleet.machine && ` - ${request.fleet.machine.name}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(request.created_at).toLocaleDateString('tr-TR')}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{typeOpt?.label}</span>
                    </div>
                    {request.description && (
                      <p className="mt-2 text-sm text-gray-500 line-clamp-1">{request.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Yeni Talep Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Yeni Servis Talebi" size="md">
        <div className="p-6 space-y-4">
          {/* Admin için firma seçimi */}
          {!isCustomer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Firma *</label>
              <select
                value={form.customer_id}
                onChange={(e) => setForm(prev => ({ ...prev, customer_id: e.target.value, fleet_id: '' }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Firma seçin</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
              {customers.length === 0 && (
                <p className="mt-1 text-xs text-red-500">Aktif müşteri bulunamadı</p>
              )}
            </div>
          )}

          {/* Makine seçimi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Makine</label>
            <select
              value={form.fleet_id}
              onChange={(e) => setForm(prev => ({ ...prev, fleet_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Makine seçin (opsiyonel)</option>
              {filteredFleetForModal.map(f => (
                <option key={f.id} value={f.id}>
                  {f.serial_number} {f.machine ? `- ${f.machine.name}` : ''}
                </option>
              ))}
            </select>
            {filteredFleetForModal.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {isCustomer ? 'Size atanmış makine bulunamadı' : 'Bu müşteriye atanmış makine yok'}
              </p>
            )}
          </div>

          {/* Tip ve Öncelik */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tip *</label>
              <select
                value={form.type}
                onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {TYPE_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Öncelik</label>
              <select
                value={form.priority}
                onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <Textarea
            label="Açıklama *"
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Sorunu veya talebi detaylı açıklayın..."
            rows={4}
          />

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleSave} loading={saving}>Talep Oluştur</Button>
          </div>
        </div>
      </Modal>

      {/* Detay Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Talep Detayı" size="md">
        {selectedRequest && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedRequest.title}</h3>
              <StatusBadge status={selectedRequest.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Firma</p>
                <p className="font-medium">{selectedRequest.customer?.company_name || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Makine</p>
                <p className="font-medium">{selectedRequest.fleet?.serial_number || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Tip</p>
                <p className="font-medium">{TYPE_OPTIONS.find(t => t.value === selectedRequest.type)?.label}</p>
              </div>
              <div>
                <p className="text-gray-500">Öncelik</p>
                <p className={`font-medium ${PRIORITY_OPTIONS.find(p => p.value === selectedRequest.priority)?.color}`}>
                  {PRIORITY_OPTIONS.find(p => p.value === selectedRequest.priority)?.label}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Oluşturulma</p>
                <p className="font-medium">{new Date(selectedRequest.created_at).toLocaleString('tr-TR')}</p>
              </div>
            </div>

            {selectedRequest.description && (
              <div>
                <p className="text-gray-500 text-sm mb-1">Açıklama</p>
                <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedRequest.description}</p>
              </div>
            )}

            {!isCustomer && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Durum Güncelle</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <Button
                      key={s.value}
                      size="sm"
                      variant={selectedRequest.status === s.value ? 'primary' : 'outline'}
                      onClick={() => updateStatus(selectedRequest, s.value)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => setShowDetailModal(false)}>Kapat</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ServicesPage
