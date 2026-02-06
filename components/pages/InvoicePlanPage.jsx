'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Wallet, Calendar, Building2, Package, Plus, Edit, Trash2, Check, X,
  FileText, Download, ChevronDown, ChevronRight, RefreshCw, Calculator,
  Clock, CheckCircle2, AlertCircle, Truck, Filter, Search
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import { SkeletonTable } from '@/components/ui/Skeleton'

const PLAN_STATUS = {
  PLANNED: { label: 'Planlandı', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Onaylandı', color: 'bg-blue-100 text-blue-700' },
  INVOICED: { label: 'Fatura Kesildi', color: 'bg-emerald-100 text-emerald-700' },
  PAID: { label: 'Ödendi', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'İptal', color: 'bg-gray-100 text-gray-500' }
}

const ITEM_TYPES = {
  RENTAL: { label: 'Kiralama', icon: Package, color: 'text-blue-600' },
  TRANSPORT_DELIVERY: { label: 'Nakliye (Gidiş)', icon: Truck, color: 'text-amber-600' },
  TRANSPORT_RETURN: { label: 'Nakliye (Dönüş)', icon: Truck, color: 'text-orange-600' }
}

const InvoicePlanPage = ({ user, showToast, isAdmin }) => {
  const [plans, setPlans] = useState([])
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expandedPlan, setExpandedPlan] = useState(null)
  
  // Generate modal
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [generating, setGenerating] = useState(false)
  
  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [editingItems, setEditingItems] = useState([])
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Fatura planları
      const { data: plansData, error: plansErr } = await supabase
        .from('invoice_plans')
        .select(`
          *,
          contract:contracts(id, contract_number, total_amount, currency),
          company:companies(id, name),
          items:invoice_plan_items(*)
        `)
        .order('billing_date', { ascending: false })

      if (plansErr) throw plansErr
      setPlans(plansData || [])

      // Aktif sözleşmeler (plan oluşturmak için)
      const { data: contractsData } = await supabase
        .from('contracts')
        .select(`
          *,
          company:companies(id, name),
          proposal:proposals(id, proposal_number, quote_items)
        `)
        .in('status', ['ACTIVE', 'SIGNED'])
        .order('created_at', { ascending: false })

      setContracts(contractsData || [])
    } catch (err) {
      console.error('Load data error:', err)
      showToast('Veriler yüklenemedi', 'error')
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  // Fatura planı oluştur
  const generatePlan = async () => {
    if (!selectedContract) {
      showToast('Sözleşme seçin', 'error')
      return
    }
    setGenerating(true)
    try {
      const contract = contracts.find(c => c.id === selectedContract)
      if (!contract) throw new Error('Sözleşme bulunamadı')

      // Delivery items al
      const { data: deliveryItems } = await supabase
        .from('delivery_items')
        .select('*')
        .eq('proposal_id', contract.proposal_id)

      if (!deliveryItems || deliveryItems.length === 0) {
        showToast('Bu sözleşmede teslimat kalemi yok', 'error')
        setGenerating(false)
        return
      }

      // Quote items al
      let quoteItems = []
      try {
        const raw = contract.proposal?.quote_items || contract.quote_items
        quoteItems = Array.isArray(raw) ? raw : JSON.parse(raw || '[]')
      } catch { quoteItems = [] }

      // Şu anki ay için plan oluştur
      const now = new Date()
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0) // Ayın son günü
      const billingDate = new Date(now.getFullYear(), now.getMonth(), 30)
      if (billingDate > periodEnd) billingDate.setDate(periodEnd.getDate())

      const periodLabel = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })

      // Her makine için kalem hesapla
      const planItems = []
      let rentalTotal = 0
      let transportTotal = 0

      for (const di of deliveryItems) {
        const quoteItem = quoteItems.find(q => q.machine_type === di.machine_type) || {}
        const monthlyRate = parseFloat(quoteItem.monthly_rate || quoteItem.unit_price || 0)
        const dailyRate = monthlyRate / 30
        const transportCost = parseFloat(quoteItem.transport_cost || di.transport_cost || 0)

        // Teslimat tarihi
        const deliveryDate = di.delivery_completed_at ? new Date(di.delivery_completed_at) : null
        // İade tarihi
        const returnDate = di.return_completed_at ? new Date(di.return_completed_at) : null

        // Bu ay içinde kaç gün kirada?
        let billableDays = 0
        let itemPeriodStart = periodStart
        let itemPeriodEnd = periodEnd

        if (deliveryDate) {
          // Teslimat bu ayda mı?
          if (deliveryDate >= periodStart && deliveryDate <= periodEnd) {
            itemPeriodStart = deliveryDate
            billableDays = Math.ceil((periodEnd - deliveryDate) / (1000 * 60 * 60 * 24)) + 1
          } else if (deliveryDate < periodStart) {
            // Teslimat geçmiş ayda
            billableDays = 30 // Tam ay
          }

          // İade bu ayda mı?
          if (returnDate && returnDate >= periodStart && returnDate <= periodEnd) {
            itemPeriodEnd = returnDate
            billableDays = Math.ceil((returnDate - Math.max(itemPeriodStart, periodStart)) / (1000 * 60 * 60 * 24)) + 1
          } else if (returnDate && returnDate < periodStart) {
            // İade geçmiş ayda yapılmış, bu ay faturalanmaz
            billableDays = 0
          }
        }

        // Kiralama kalemi
        if (billableDays > 0 && di.delivery_status === 'DELIVERED') {
          const amount = dailyRate * billableDays
          rentalTotal += amount

          planItems.push({
            delivery_item_id: di.id,
            machine_type: di.machine_type,
            machine_serial: di.assigned_machine_serial,
            item_type: 'RENTAL',
            description: `${di.machine_type} - ${billableDays} gün kiralama`,
            period_start: itemPeriodStart.toISOString().split('T')[0],
            period_end: itemPeriodEnd.toISOString().split('T')[0],
            total_days: 30,
            billable_days: billableDays,
            daily_rate: dailyRate,
            monthly_rate: monthlyRate,
            amount: Math.round(amount * 100) / 100,
            sort_order: planItems.length
          })
        }

        // Nakliye gidiş (teslimatta)
        if (deliveryDate && deliveryDate >= periodStart && deliveryDate <= periodEnd && !di.transport_delivery_invoiced && transportCost > 0) {
          const halfTransport = transportCost / 2
          transportTotal += halfTransport

          planItems.push({
            delivery_item_id: di.id,
            machine_type: di.machine_type,
            machine_serial: di.assigned_machine_serial,
            item_type: 'TRANSPORT_DELIVERY',
            description: `${di.machine_type} - Nakliye (Gidiş)`,
            amount: Math.round(halfTransport * 100) / 100,
            sort_order: planItems.length
          })
        }

        // Nakliye dönüş (iadede)
        if (returnDate && returnDate >= periodStart && returnDate <= periodEnd && !di.transport_return_invoiced && transportCost > 0) {
          const halfTransport = transportCost / 2
          transportTotal += halfTransport

          planItems.push({
            delivery_item_id: di.id,
            machine_type: di.machine_type,
            machine_serial: di.assigned_machine_serial,
            item_type: 'TRANSPORT_RETURN',
            description: `${di.machine_type} - Nakliye (Dönüş)`,
            amount: Math.round(halfTransport * 100) / 100,
            sort_order: planItems.length
          })
        }
      }

      if (planItems.length === 0) {
        showToast('Bu dönem için faturalanacak kalem yok', 'error')
        setGenerating(false)
        return
      }

      // Plan oluştur
      const { data: plan, error: planErr } = await supabase
        .from('invoice_plans')
        .insert({
          contract_id: contract.id,
          company_id: contract.company_id,
          billing_date: billingDate.toISOString().split('T')[0],
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          period_label: periodLabel,
          rental_subtotal: Math.round(rentalTotal * 100) / 100,
          transport_subtotal: Math.round(transportTotal * 100) / 100,
          total_amount: Math.round((rentalTotal + transportTotal) * 100) / 100,
          currency: contract.currency || 'TRY',
          status: 'PLANNED',
          created_by: user.id
        })
        .select()
        .single()

      if (planErr) throw planErr

      // Kalemleri ekle
      const itemsWithPlanId = planItems.map(item => ({
        ...item,
        invoice_plan_id: plan.id
      }))

      const { error: itemsErr } = await supabase
        .from('invoice_plan_items')
        .insert(itemsWithPlanId)

      if (itemsErr) throw itemsErr

      showToast('Fatura planı oluşturuldu', 'success')
      setShowGenerateModal(false)
      setSelectedContract(null)
      loadData()
    } catch (err) {
      console.error('Generate plan error:', err)
      showToast('Plan oluşturulamadı: ' + err.message, 'error')
    }
    setGenerating(false)
  }

  // Plan onayla
  const approvePlan = async (plan) => {
    if (!confirm('Fatura planını onaylamak istediğinize emin misiniz?')) return
    try {
      const { error } = await supabase
        .from('invoice_plans')
        .update({
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
          approved_by: user.id
        })
        .eq('id', plan.id)

      if (error) throw error
      showToast('Plan onaylandı', 'success')
      loadData()
    } catch (err) {
      showToast('Onaylama başarısız', 'error')
    }
  }

  // Plan düzenle
  const openEditModal = async (plan) => {
    setEditingPlan(plan)
    setEditingItems(plan.items || [])
    setShowEditModal(true)
  }

  const updateItem = (itemId, field, value) => {
    setEditingItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value }
        // Tutar yeniden hesapla
        if (field === 'billable_days' || field === 'daily_rate') {
          const days = field === 'billable_days' ? parseFloat(value) : item.billable_days
          const rate = field === 'daily_rate' ? parseFloat(value) : item.daily_rate
          if (days && rate) {
            updated.amount = Math.round(days * rate * 100) / 100
          }
        }
        return updated
      }
      return item
    }))
  }

  const savePlanChanges = async () => {
    setSaving(true)
    try {
      // Kalemleri güncelle
      for (const item of editingItems) {
        await supabase
          .from('invoice_plan_items')
          .update({
            billable_days: item.billable_days,
            daily_rate: item.daily_rate,
            amount: item.amount,
            description: item.description
          })
          .eq('id', item.id)
      }

      // Toplamları yeniden hesapla
      const rentalTotal = editingItems
        .filter(i => i.item_type === 'RENTAL')
        .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
      const transportTotal = editingItems
        .filter(i => i.item_type !== 'RENTAL')
        .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)

      await supabase
        .from('invoice_plans')
        .update({
          rental_subtotal: rentalTotal,
          transport_subtotal: transportTotal,
          total_amount: rentalTotal + transportTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingPlan.id)

      showToast('Değişiklikler kaydedildi', 'success')
      setShowEditModal(false)
      loadData()
    } catch (err) {
      showToast('Kayıt başarısız', 'error')
    }
    setSaving(false)
  }

  // Plan sil
  const deletePlan = async (plan) => {
    if (!confirm('Bu fatura planını silmek istediğinize emin misiniz?')) return
    try {
      await supabase.from('invoice_plan_items').delete().eq('invoice_plan_id', plan.id)
      await supabase.from('invoice_plans').delete().eq('id', plan.id)
      showToast('Plan silindi', 'success')
      loadData()
    } catch (err) {
      showToast('Silme başarısız', 'error')
    }
  }

  const formatCurrency = (amount, currency = 'TRY') => {
    const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'
    return `${sym}${(amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'

  const filteredPlans = plans.filter(p => {
    if (filter === 'all') return true
    return p.status === filter
  })

  const stats = {
    total: plans.length,
    planned: plans.filter(p => p.status === 'PLANNED').length,
    approved: plans.filter(p => p.status === 'APPROVED').length,
    invoiced: plans.filter(p => p.status === 'INVOICED').length,
    totalAmount: plans.filter(p => ['PLANNED', 'APPROVED']).reduce((sum, p) => sum + (p.total_amount || 0), 0)
  }

  if (loading) return <div className="p-6"><SkeletonTable rows={5} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`p-4 cursor-pointer ${filter === 'all' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter('all')}>
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">Toplam Plan</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 cursor-pointer ${filter === 'PLANNED' ? 'ring-2 ring-amber-500' : ''}`} onClick={() => setFilter('PLANNED')}>
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{stats.planned}</p>
              <p className="text-xs text-gray-500">Bekleyen</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 cursor-pointer ${filter === 'APPROVED' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter('APPROVED')}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.approved}</p>
              <p className="text-xs text-gray-500">Onaylı</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 cursor-pointer ${filter === 'INVOICED' ? 'ring-2 ring-emerald-500' : ''}`} onClick={() => setFilter('INVOICED')}>
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{stats.invoiced}</p>
              <p className="text-xs text-gray-500">Fatura Kesildi</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" icon={RefreshCw} onClick={loadData}>Yenile</Button>
          </div>
          <Button icon={Plus} onClick={() => setShowGenerateModal(true)}>
            Fatura Planı Oluştur
          </Button>
        </div>
      </Card>

      {/* Plans List */}
      {filteredPlans.length === 0 ? (
        <EmptyState icon={Wallet} title="Fatura planı yok" description="Henüz oluşturulmuş fatura planı bulunmuyor." />
      ) : (
        <div className="space-y-4">
          {filteredPlans.map(plan => (
            <Card key={plan.id} className="overflow-hidden">
              {/* Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">{plan.company?.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PLAN_STATUS[plan.status]?.color}`}>
                        {PLAN_STATUS[plan.status]?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{plan.contract?.contract_number}</span>
                      <span>•</span>
                      <span>{plan.period_label}</span>
                      <span>•</span>
                      <span>Kesim: {formatDate(plan.billing_date)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(plan.total_amount, plan.currency)}</p>
                    <p className="text-xs text-gray-500">{plan.items?.length || 0} kalem</p>
                  </div>
                  <div>
                    {expandedPlan === plan.id ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedPlan === plan.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-500">Kiralama</p>
                      <p className="font-semibold text-blue-600">{formatCurrency(plan.rental_subtotal, plan.currency)}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-500">Nakliye</p>
                      <p className="font-semibold text-amber-600">{formatCurrency(plan.transport_subtotal, plan.currency)}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-xs text-gray-500">Toplam</p>
                      <p className="font-bold text-gray-900">{formatCurrency(plan.total_amount, plan.currency)}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="bg-white rounded-lg overflow-hidden mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left px-4 py-2 font-medium text-gray-500">Açıklama</th>
                          <th className="text-center px-4 py-2 font-medium text-gray-500 hidden sm:table-cell">Gün</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-500 hidden md:table-cell">Günlük</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-500">Tutar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(plan.items || []).map(item => {
                          const typeConfig = ITEM_TYPES[item.item_type] || ITEM_TYPES.RENTAL
                          const Icon = typeConfig.icon
                          return (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-4 h-4 ${typeConfig.color}`} />
                                  <div>
                                    <p className="font-medium text-gray-900">{item.machine_type}</p>
                                    <p className="text-xs text-gray-500">{item.description}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-center hidden sm:table-cell">
                                {item.billable_days || '-'}
                              </td>
                              <td className="px-4 py-2 text-right hidden md:table-cell text-gray-500">
                                {item.daily_rate ? formatCurrency(item.daily_rate, plan.currency) : '-'}
                              </td>
                              <td className="px-4 py-2 text-right font-medium">
                                {formatCurrency(item.amount, plan.currency)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {plan.status === 'PLANNED' && (
                      <>
                        <Button size="sm" variant="success" icon={Check} onClick={() => approvePlan(plan)}>
                          Onayla
                        </Button>
                        <Button size="sm" variant="outline" icon={Edit} onClick={() => openEditModal(plan)}>
                          Düzenle
                        </Button>
                        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => deletePlan(plan)} className="text-red-500">
                          Sil
                        </Button>
                      </>
                    )}
                    {plan.status === 'APPROVED' && (
                      <Button size="sm" variant="primary" icon={FileText}>
                        Fatura Oluştur
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Generate Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => { setShowGenerateModal(false); setSelectedContract(null) }}
        title="Fatura Planı Oluştur"
        size="md"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Bu ay için otomatik fatura planı oluşturulacak. Teslimat tarihlerine göre kiralama günleri ve nakliye bedelleri hesaplanacak.
          </p>

          <Select
            label="Sözleşme Seçin"
            value={selectedContract || ''}
            onChange={(e) => setSelectedContract(e.target.value)}
          >
            <option value="">Seçin</option>
            {contracts.map(c => (
              <option key={c.id} value={c.id}>
                {c.contract_number} - {c.company?.name}
              </option>
            ))}
          </Select>

          {selectedContract && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Not:</strong> Kiralama günleri 30 güne bölünerek hesaplanır. Nakliye bedeli teslimat ve iadede yarı yarıya faturalanır.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowGenerateModal(false)}>
              İptal
            </Button>
            <Button 
              variant="primary" 
              className="flex-1" 
              onClick={generatePlan} 
              loading={generating}
              disabled={!selectedContract}
              icon={Calculator}
            >
              Hesapla ve Oluştur
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Fatura Planı Düzenle"
        size="lg"
      >
        <div className="p-6 space-y-4">
          {editingPlan && (
            <>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm">
                  <strong>{editingPlan.company?.name}</strong> - {editingPlan.period_label}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2">Makine</th>
                      <th className="text-center px-3 py-2 w-20">Gün</th>
                      <th className="text-right px-3 py-2 w-28">Günlük</th>
                      <th className="text-right px-3 py-2 w-28">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {editingItems.map(item => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.machine_type}</p>
                          <p className="text-xs text-gray-500">{ITEM_TYPES[item.item_type]?.label}</p>
                        </td>
                        <td className="px-3 py-2">
                          {item.item_type === 'RENTAL' ? (
                            <Input
                              type="number"
                              value={item.billable_days || ''}
                              onChange={(e) => updateItem(item.id, 'billable_days', e.target.value)}
                              className="text-center"
                              min={0}
                              max={31}
                            />
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2">
                          {item.item_type === 'RENTAL' ? (
                            <Input
                              type="number"
                              value={item.daily_rate || ''}
                              onChange={(e) => updateItem(item.id, 'daily_rate', e.target.value)}
                              className="text-right"
                              step="0.01"
                            />
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            value={item.amount || ''}
                            onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                            className="text-right font-medium"
                            step="0.01"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-right">Toplam:</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(editingItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0), editingPlan.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>
                  İptal
                </Button>
                <Button variant="primary" className="flex-1" onClick={savePlanChanges} loading={saving}>
                  Kaydet
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default InvoicePlanPage
