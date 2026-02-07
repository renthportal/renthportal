'use client'
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { invoicePlanService } from '@/lib/invoicePlanService'
import {
  Wallet, Package, Plus, Edit, Trash2, Check, X,
  FileText, ChevronDown, ChevronRight, RefreshCw, Calculator,
  Clock, CheckCircle2, AlertCircle, Truck, AlertTriangle,
  Wrench, ShieldAlert, UserCheck, RotateCcw
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

// Admin: teknik durum isimleri
const PLAN_STATUS = {
  DRAFT: { label: 'Taslak', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  PLANNED: { label: 'Planlandı', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  APPROVED: { label: 'Onaylandı', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  INVOICED: { label: 'Fatura Kesildi', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  PAID: { label: 'Ödendi', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  CANCELLED: { label: 'İptal', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' }
}

// Müşteri: anlaşılır etiketler (teknik terimler yerine iş dili)
const CUSTOMER_STATUS = {
  PLANNED: { label: 'Hesaplandı', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  APPROVED: { label: 'Kesinleşti', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  INVOICED: { label: 'Ödeme Bekliyor', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  PAID: { label: 'Ödendi', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  CANCELLED: { label: 'İptal', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' }
}

const ITEM_TYPES = {
  RENTAL: { label: 'Kiralama', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
  TRANSPORT_DELIVERY: { label: 'Nakliye (Gidiş)', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
  TRANSPORT_RETURN: { label: 'Nakliye (Dönüş)', icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' },
  SERVICE: { label: 'Servis/Bakım', icon: Wrench, color: 'text-purple-600', bg: 'bg-purple-50' },
  DAMAGE: { label: 'Hasar Bedeli', icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50' },
  OPERATOR: { label: 'Operatör Hizmeti', icon: UserCheck, color: 'text-teal-600', bg: 'bg-teal-50' },
  EXTRA: { label: 'Ekstra Hizmet', icon: Plus, color: 'text-gray-600', bg: 'bg-gray-50' }
}

const MANUAL_TYPES = ['SERVICE', 'DAMAGE', 'OPERATOR', 'EXTRA']

// v5 FIX H6: Geçerli status geçişleri — defense-in-depth
const VALID_TRANSITIONS = {
  DRAFT:     ['PLANNED', 'CANCELLED'],
  PLANNED:   ['APPROVED', 'CANCELLED'],
  APPROVED:  ['INVOICED', 'PLANNED', 'CANCELLED'],
  INVOICED:  ['PAID'],
  PAID:      [],
  CANCELLED: []
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const fmt = (amount, currency = 'TRY') => {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'
  return `${sym}${(amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'
const monthKey = (date) => { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (key) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) }
const currentMK = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const InvoicePlanPage = ({ user, showToast, isAdmin }) => {
  const isCustomer = !isAdmin

  // --- DATA ---
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  // --- FILTERS ---
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // --- UI STATE ---
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [checking, setChecking] = useState(false)
  const extensionChecked = useRef(false)

  // --- EDIT MODAL ---
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [editingItems, setEditingItems] = useState([])
  const [saving, setSaving] = useState(false)

  // --- ADD ITEM MODAL ---
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [addItemPlan, setAddItemPlan] = useState(null)
  const [newItem, setNewItem] = useState({ item_type: 'SERVICE', machine_type: '', description: '', amount: '' })
  const [bulkApproving, setBulkApproving] = useState(false)
  const [recalculating, setRecalculating] = useState(null) // proposalId when recalculating

  // ═══════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('invoice_plans').select(`
        *, proposal:proposals(id, proposal_number, currency, quote_items),
        company:companies(id, name), items:invoice_plan_items(*)
      `).neq('status', 'CANCELLED').order('period_start', { ascending: false })

      // Müşteri: DRAFT'ları gösterme (tahmini, henüz kesinleşmemiş)
      if (isCustomer) q = q.eq('company_id', user.company_id).neq('status', 'DRAFT')
      const { data, error } = await q
      if (error) throw error
      setPlans(data || [])
    } catch (err) {
      console.error('Load error:', err)
      showToast('Veriler yüklenemedi', 'error')
    }
    setLoading(false)
  }, [showToast, isCustomer, user?.company_id])

  useEffect(() => { loadData() }, [loadData])

  // ═══════════════════════════════════════════════════════════
  // EXTENSION CHECK (on page load, staff only — runs once)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (isCustomer || loading || extensionChecked.current) return
    extensionChecked.current = true
    const check = async () => {
      setChecking(true)
      try {
        const result = await invoicePlanService.checkExtensions()
        if (result.extensions > 0) {
          showToast(`${result.extensions} uzama planı oluşturuldu`, 'info')
          loadData()
        }
      } catch (err) { console.error('Extension check error:', err) }
      setChecking(false)
    }
    check()
  }, [isCustomer, loading]) // eslint-disable-line

  // ═══════════════════════════════════════════════════════════
  // STATUS TRANSITIONS
  // ═══════════════════════════════════════════════════════════
  const changeStatus = async (plan, newStatus, confirmMsg) => {
    // v5 FIX H6: Geçersiz geçiş kontrolü
    const allowed = VALID_TRANSITIONS[plan.status] || []
    if (!allowed.includes(newStatus)) {
      showToast(`${PLAN_STATUS[plan.status]?.label} → ${PLAN_STATUS[newStatus]?.label} geçişi yapılamaz`, 'error')
      return
    }
    if (!confirm(confirmMsg)) return
    try {
      const updates = { status: newStatus, updated_at: new Date().toISOString() }
      if (newStatus === 'APPROVED') {
        updates.approved_at = new Date().toISOString()
        updates.approved_by = user.id
        updates.is_estimated = false
      }
      if (newStatus === 'INVOICED') {
        updates.invoiced_at = new Date().toISOString()
        updates.invoiced_by = user.id
        // v5 Ö1: Opsiyonel fatura numarası
        const invoiceNo = prompt('Fatura numarası girin (boş bırakabilirsiniz):')
        if (invoiceNo !== null && invoiceNo.trim()) {
          updates.invoice_number = invoiceNo.trim()
        }
      }
      if (newStatus === 'PAID') {
        updates.paid_at = new Date().toISOString()
      }
      // v3: APPROVED → PLANNED geri alma
      if (newStatus === 'PLANNED' && plan.status === 'APPROVED') {
        updates.approved_at = null
        updates.approved_by = null
      }

      const { error } = await supabase.from('invoice_plans').update(updates).eq('id', plan.id)
      if (error) throw error

      // Transport flags: mark as invoiced when plan reaches INVOICED
      if (newStatus === 'INVOICED') {
        for (const item of (plan.items || [])) {
          if (!item.delivery_item_id) continue
          if (item.item_type === 'TRANSPORT_DELIVERY')
            await supabase.from('delivery_items').update({ transport_delivery_invoiced: true }).eq('id', item.delivery_item_id)
          if (item.item_type === 'TRANSPORT_RETURN')
            await supabase.from('delivery_items').update({ transport_return_invoiced: true }).eq('id', item.delivery_item_id)
        }
      }

      showToast(PLAN_STATUS[newStatus].label + ' olarak güncellendi', 'success')
      loadData()
    } catch (err) { showToast('İşlem başarısız: ' + err.message, 'error') }
  }

  // ═══════════════════════════════════════════════════════════
  // MANUAL RECALCULATE (v3 NEW)
  // ═══════════════════════════════════════════════════════════
  const handleRecalculate = async (proposalId) => {
    if (!confirm('Bu projenin tüm TASLAK ve PLANLANMIŞ fatura planları yeniden hesaplanacak. Onaylı planlar korunur. Devam?')) return
    setRecalculating(proposalId)
    try {
      const result = await invoicePlanService.recalculateProposal(proposalId, user.id)
      const parts = []
      if (result.updated > 0) parts.push(`${result.updated} güncellendi`)
      if (result.created > 0) parts.push(`${result.created} yeni oluşturuldu`)
      if (result.cancelled > 0) parts.push(`${result.cancelled} iptal edildi`)
      showToast(parts.length > 0 ? `Yeniden hesaplandı: ${parts.join(', ')}` : 'Değişiklik yok', 'success')
      // v5 FIX H5: Frozen plan uyarısı
      if (result.skippedFrozen?.length > 0) {
        const frozenList = result.skippedFrozen.map(f => `${f.period} (${f.status})`).join(', ')
        showToast(`⚠️ ${result.skippedFrozen.length} onaylı/faturalı plan korundu: ${frozenList}`, 'warning')
      }
      loadData()
    } catch (err) { showToast('Yeniden hesaplama başarısız: ' + err.message, 'error') }
    setRecalculating(null)
  }

  // ═══════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════
  const deletePlan = async (plan) => {
    if (!['DRAFT', 'PLANNED', 'CANCELLED'].includes(plan.status)) {
      showToast('Sadece Taslak, Planlandı veya İptal planlar silinebilir', 'error'); return
    }
    if (!confirm('Bu planı silmek istediğinize emin misiniz?')) return
    try {
      await supabase.from('invoice_plan_items').delete().eq('invoice_plan_id', plan.id)
      const { error } = await supabase.from('invoice_plans').delete().eq('id', plan.id)
      if (error) throw error
      showToast('Plan silindi', 'success'); loadData()
    } catch (err) { showToast('Silme başarısız', 'error') }
  }

  // ═══════════════════════════════════════════════════════════
  // EDIT AUTO ITEMS
  // ═══════════════════════════════════════════════════════════
  const openEdit = (plan) => {
    setEditingPlan(plan)
    setEditingItems(JSON.parse(JSON.stringify(plan.items || [])))
    setShowEditModal(true)
  }

  const updateItem = (itemId, field, value) => {
    setEditingItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const updated = { ...item, [field]: value }
      if ((field === 'billable_days' || field === 'daily_rate') && updated.item_type === 'RENTAL') {
        const d = parseFloat(field === 'billable_days' ? value : item.billable_days) || 0
        const r = parseFloat(field === 'daily_rate' ? value : item.daily_rate) || 0
        updated.amount = Math.round(d * r * 100) / 100
      }
      return updated
    }))
  }

  const saveEdit = async () => {
    const invalid = editingItems.some(i => {
      // v4 FIX L1: NaN ve boş değer kontrolü eklendi
      const amount = parseFloat(i.amount)
      if (isNaN(amount) || amount < 0) return true
      if (i.item_type === 'RENTAL') {
        const days = parseFloat(i.billable_days)
        const rate = parseFloat(i.daily_rate)
        if (isNaN(days) || days < 0 || days > 31) return true
        if (isNaN(rate) || rate < 0) return true
      }
      return false
    })
    if (invalid) { showToast('Geçersiz değerler: tüm alanlar dolu ve ≥ 0 olmalı (gün 0-31)', 'error'); return }

    setSaving(true)
    try {
      for (const item of editingItems) {
        await supabase.from('invoice_plan_items').update({
          billable_days: item.billable_days, daily_rate: item.daily_rate,
          amount: item.amount, description: item.description
        }).eq('id', item.id)
      }
      const rental = editingItems.filter(i => i.item_type === 'RENTAL').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
      const transport = editingItems.filter(i => ['TRANSPORT_DELIVERY', 'TRANSPORT_RETURN'].includes(i.item_type)).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
      const extra = editingItems.filter(i => MANUAL_TYPES.includes(i.item_type)).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

      // v5 FIX H1: Yuvarlama — kuruş kaymasını önle
      const r = (v) => Math.round(v * 100) / 100
      const planUpdates = {
        rental_subtotal: r(rental), transport_subtotal: r(transport),
        extra_subtotal: r(extra), total_amount: r(rental + transport + extra),
        updated_at: new Date().toISOString()
      }

      // v5 FIX H3: APPROVED plan düzenlenirse otomatik PLANNED'a çek
      if (editingPlan.status === 'APPROVED') {
        planUpdates.status = 'PLANNED'
        planUpdates.approved_at = null
        planUpdates.approved_by = null
      }

      await supabase.from('invoice_plans').update(planUpdates).eq('id', editingPlan.id)

      if (editingPlan.status === 'APPROVED') {
        showToast('Kaydedildi — plan geri alındı, tekrar onay gerekiyor', 'warning')
      } else {
        showToast('Kaydedildi', 'success')
      }
      setShowEditModal(false); loadData()
    } catch (err) { showToast('Kayıt başarısız', 'error') }
    setSaving(false)
  }

  // ═══════════════════════════════════════════════════════════
  // ADD MANUAL ITEM
  // ═══════════════════════════════════════════════════════════
  const openAddItem = (plan) => {
    setAddItemPlan(plan)
    setNewItem({ item_type: 'SERVICE', machine_type: '', description: '', amount: '' })
    setShowAddItemModal(true)
  }

  const saveNewItem = async () => {
    const amount = parseFloat(newItem.amount)
    if (!newItem.description.trim()) { showToast('Açıklama girin', 'error'); return }
    if (isNaN(amount) || amount <= 0) { showToast('Geçerli tutar girin', 'error'); return }

    setSaving(true)
    try {
      const existingItems = addItemPlan.items?.length || 0
      await supabase.from('invoice_plan_items').insert({
        invoice_plan_id: addItemPlan.id,
        item_type: newItem.item_type,
        machine_type: newItem.machine_type || null,
        description: newItem.description.trim(),
        amount: Math.round(amount * 100) / 100,
        sort_order: existingItems,
        is_auto: false
      })

      // Update plan totals
      const { data: allItems } = await supabase.from('invoice_plan_items')
        .select('*').eq('invoice_plan_id', addItemPlan.id)

      const rental = (allItems || []).filter(i => i.item_type === 'RENTAL').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
      const transport = (allItems || []).filter(i => ['TRANSPORT_DELIVERY', 'TRANSPORT_RETURN'].includes(i.item_type)).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
      const extra = (allItems || []).filter(i => MANUAL_TYPES.includes(i.item_type)).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

      // v5 FIX H1: Yuvarlama
      const r = (v) => Math.round(v * 100) / 100
      const planUpdates = {
        rental_subtotal: r(rental), transport_subtotal: r(transport),
        extra_subtotal: r(extra), total_amount: r(rental + transport + extra),
        updated_at: new Date().toISOString()
      }

      // v5 FIX H3: APPROVED plan'a kalem eklenirse PLANNED'a çek
      if (addItemPlan.status === 'APPROVED') {
        planUpdates.status = 'PLANNED'
        planUpdates.approved_at = null
        planUpdates.approved_by = null
      }

      await supabase.from('invoice_plans').update(planUpdates).eq('id', addItemPlan.id)

      if (addItemPlan.status === 'APPROVED') {
        showToast('Kalem eklendi — plan geri alındı, tekrar onay gerekiyor', 'warning')
      } else {
        showToast('Kalem eklendi', 'success')
      }
      setShowAddItemModal(false)
      loadData()
    } catch (err) { showToast('Ekleme başarısız', 'error') }
    setSaving(false)
  }

  // Delete manual item
  const deleteItem = async (plan, item) => {
    if (!MANUAL_TYPES.includes(item.item_type)) {
      showToast('Otomatik kalemler silinemez. Düzenle butonunu kullanın.', 'error'); return
    }
    if (!confirm(`"${item.description}" kalemini silmek istediğinize emin misiniz?`)) return
    try {
      await supabase.from('invoice_plan_items').delete().eq('id', item.id)

      const { data: remaining } = await supabase.from('invoice_plan_items')
        .select('*').eq('invoice_plan_id', plan.id)

      const rental = (remaining || []).filter(i => i.item_type === 'RENTAL').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
      const transport = (remaining || []).filter(i => ['TRANSPORT_DELIVERY', 'TRANSPORT_RETURN'].includes(i.item_type)).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
      const extra = (remaining || []).filter(i => MANUAL_TYPES.includes(i.item_type)).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

      // v5 FIX H1: Yuvarlama
      const planUpdates = {
        rental_subtotal: Math.round(rental * 100) / 100,
        transport_subtotal: Math.round(transport * 100) / 100,
        extra_subtotal: Math.round(extra * 100) / 100,
        total_amount: Math.round((rental + transport + extra) * 100) / 100,
        updated_at: new Date().toISOString()
      }

      // v5 FIX H3: APPROVED plan'dan kalem silinirse PLANNED'a çek
      if (plan.status === 'APPROVED') {
        planUpdates.status = 'PLANNED'
        planUpdates.approved_at = null
        planUpdates.approved_by = null
      }

      await supabase.from('invoice_plans').update(planUpdates).eq('id', plan.id)

      if (plan.status === 'APPROVED') {
        showToast('Kalem silindi — plan geri alındı, tekrar onay gerekiyor', 'warning')
      } else {
        showToast('Kalem silindi', 'success')
      }
      loadData()
    } catch (err) { showToast('Silme başarısız', 'error') }
  }

  // ═══════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════
  const companies = useMemo(() => {
    const map = {}
    plans.forEach(p => { if (p.company) map[p.company.id] = p.company.name })
    return Object.entries(map).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [plans])

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      if (filterMonth !== 'all' && monthKey(p.period_start) !== filterMonth) return false
      if (filterCompany !== 'all' && p.company_id !== filterCompany) return false
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      if (filterType !== 'all') {
        const hasType = (p.items || []).some(i => {
          if (filterType === 'RENTAL') return i.item_type === 'RENTAL'
          if (filterType === 'TRANSPORT') return ['TRANSPORT_DELIVERY', 'TRANSPORT_RETURN'].includes(i.item_type)
          if (filterType === 'EXTRA') return MANUAL_TYPES.includes(i.item_type)
          return false
        })
        if (!hasType) return false
      }
      return true
    })
  }, [plans, filterMonth, filterCompany, filterStatus, filterType])

  const stats = useMemo(() => ({
    draft: plans.filter(p => p.status === 'DRAFT').length,
    planned: plans.filter(p => p.status === 'PLANNED').length,
    approved: plans.filter(p => p.status === 'APPROVED').length,
    invoiced: plans.filter(p => p.status === 'INVOICED').length,
    paid: plans.filter(p => p.status === 'PAID').length,
    // v5 FIX T1: Kesin ve tahmini ayrımı
    confirmedAmount: plans.filter(p => ['PLANNED', 'APPROVED'].includes(p.status))
      .reduce((s, p) => s + (p.total_amount || 0), 0),
    draftAmount: plans.filter(p => p.status === 'DRAFT')
      .reduce((s, p) => s + (p.total_amount || 0), 0)
  }), [plans])

  const availableMonths = useMemo(() => {
    const set = new Set(plans.map(p => monthKey(p.period_start)))
    set.add(currentMK())
    return [...set].sort().reverse().map(k => ({ key: k, label: monthLabel(k) }))
  }, [plans])

  // ═══════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════
  const StatusDot = ({ status }) => {
    const cfg = isCustomer ? (CUSTOMER_STATUS[status] || PLAN_STATUS[status]) : PLAN_STATUS[status]
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${cfg?.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
        {cfg?.label}
      </span>
    )
  }

  // v3 FIX: Admin action buttons — added recalculate and APPROVED→PLANNED
  const ActionButtons = ({ plan }) => {
    const s = plan.status
    return (
      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
        {s === 'DRAFT' && <>
          <Button size="sm" variant="primary" icon={Check}
            onClick={() => changeStatus(plan, 'PLANNED', 'Taslağı planlandı olarak işaretlemek istediğinize emin misiniz?')}>Planla</Button>
          <Button size="sm" variant="outline" icon={Edit} onClick={() => openEdit(plan)}>Düzenle</Button>
          <Button size="sm" variant="outline" icon={Plus} onClick={() => openAddItem(plan)}>Kalem Ekle</Button>
          <Button size="sm" variant="outline" icon={RefreshCw} loading={recalculating === plan.proposal_id}
            onClick={() => handleRecalculate(plan.proposal_id)}>Yeniden Hesapla</Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => deletePlan(plan)} className="text-red-500">Sil</Button>
        </>}
        {s === 'PLANNED' && <>
          <Button size="sm" variant="success" icon={Check}
            onClick={() => {
              // v3: Tahmini kalem uyarısı
              const hasEstimated = (plan.items || []).some(i => i.is_estimated_item)
              const msg = hasEstimated
                ? '⚠️ Bu planda tahmini kalemler var! Yine de onaylamak istediğinize emin misiniz?'
                : 'Planı onaylamak istediğinize emin misiniz?'
              changeStatus(plan, 'APPROVED', msg)
            }}>Onayla</Button>
          <Button size="sm" variant="outline" icon={Edit} onClick={() => openEdit(plan)}>Düzenle</Button>
          <Button size="sm" variant="outline" icon={Plus} onClick={() => openAddItem(plan)}>Kalem Ekle</Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => deletePlan(plan)} className="text-red-500">Sil</Button>
        </>}
        {s === 'APPROVED' && <>
          <Button size="sm" variant="primary" icon={FileText}
            onClick={() => changeStatus(plan, 'INVOICED', 'Fatura kesildi olarak işaretlenecek. Nakliye bayrakları güncellenecek. Devam?')}>Fatura Kesildi</Button>
          <Button size="sm" variant="outline" icon={Edit} onClick={() => openEdit(plan)}>Düzenle</Button>
          <Button size="sm" variant="outline" icon={Plus} onClick={() => openAddItem(plan)}>Kalem Ekle</Button>
          <Button size="sm" variant="ghost" icon={RotateCcw}
            onClick={() => changeStatus(plan, 'PLANNED', 'Planı düzeltme için geri almak istediğinize emin misiniz? Onay bilgisi kaldırılacak.')}
            className="text-amber-600">Düzeltmeye Al</Button>
          <Button size="sm" variant="ghost" icon={X}
            onClick={() => changeStatus(plan, 'CANCELLED', 'Planı iptal etmek istediğinize emin misiniz?')}
            className="text-red-500">İptal</Button>
        </>}
        {s === 'INVOICED' && <>
          <Button size="sm" variant="success" icon={Check}
            onClick={() => changeStatus(plan, 'PAID', 'Ödendi olarak işaretlenecek. Devam?')}>Ödendi</Button>
        </>}
      </div>
    )
  }

  const ItemsTable = ({ plan }) => (
    <div className="bg-white rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-3 py-2 font-medium text-gray-500">Makine / Kalem</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500 hidden lg:table-cell">Dönem</th>
            <th className="text-center px-3 py-2 font-medium text-gray-500 hidden sm:table-cell">Gün</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500 hidden md:table-cell">Günlük</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">Tutar</th>
            {isAdmin && !['INVOICED', 'PAID'].includes(plan.status) && (
              <th className="w-8"></th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {(plan.items || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(item => {
            const tc = ITEM_TYPES[item.item_type] || ITEM_TYPES.EXTRA
            const Icon = tc.icon
            const isManual = MANUAL_TYPES.includes(item.item_type)
            return (
              <tr key={item.id} className={`hover:bg-gray-50 ${isManual ? 'bg-yellow-50/30' : ''}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded ${tc.bg}`}><Icon className={`w-3.5 h-3.5 ${tc.color}`} /></div>
                    <div>
                      <p className="font-medium text-gray-900 text-xs">{item.machine_type || item.description}</p>
                      {item.machine_serial && <p className="text-[10px] text-blue-600 font-mono">{item.machine_serial}</p>}
                      <p className="text-[10px] text-gray-400">{tc.label}</p>
                      {isManual && item.machine_type && <p className="text-[10px] text-gray-500 mt-0.5">{item.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 hidden lg:table-cell">
                  {item.period_start && item.period_end ? `${fmtDate(item.period_start)} — ${fmtDate(item.period_end)}` : '—'}
                </td>
                <td className="px-3 py-2 text-center text-xs hidden sm:table-cell">{item.billable_days || '—'}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-500 hidden md:table-cell">{item.daily_rate ? fmt(item.daily_rate, plan.currency) : '—'}</td>
                <td className="px-3 py-2 text-right font-medium text-sm">{fmt(item.amount, plan.currency)}</td>
                {isAdmin && !['INVOICED', 'PAID'].includes(plan.status) && (
                  <td className="px-1 py-2">
                    {isManual && (
                      <button onClick={(e) => { e.stopPropagation(); deleteItem(plan, item) }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t font-bold">
            <td colSpan={4} className="px-3 py-2 text-right text-xs text-gray-600 hidden sm:table-cell">TOPLAM</td>
            <td className="px-3 py-2 text-right text-xs text-gray-600 sm:hidden">TOPLAM</td>
            <td className="px-3 py-2 text-right text-sm">{fmt(plan.total_amount, plan.currency)}</td>
            {isAdmin && !['INVOICED', 'PAID'].includes(plan.status) && <td></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  )

  // ═══════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════
  if (loading) return <div className="p-6"><SkeletonTable rows={5} /></div>

  // ═══════════════════════════════════════════════════════════
  // CUSTOMER VIEW (read-only, simplified)
  // ═══════════════════════════════════════════════════════════
  if (isCustomer) {
    const byProposal = {}
    plans.forEach(p => {
      const pid = p.proposal_id
      if (!byProposal[pid]) byProposal[pid] = { proposalNumber: p.proposal?.proposal_number, plans: [] }
      byProposal[pid].plans.push(p)
    })

    const customerStats = {
      outstanding: plans.filter(p => p.status === 'INVOICED').reduce((s, p) => s + (p.total_amount || 0), 0),
      upcoming: plans.filter(p => ['PLANNED', 'APPROVED'].includes(p.status)).reduce((s, p) => s + (p.total_amount || 0), 0),
      paid: plans.filter(p => p.status === 'PAID').reduce((s, p) => s + (p.total_amount || 0), 0)
    }

    return (
      <div className="p-4 lg:p-6 space-y-6">
        {/* Customer Balance Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 bg-red-50/50 border-red-100">
            <p className="text-[10px] text-red-600 font-medium">Ödenmemiş</p>
            <p className="text-lg font-bold text-red-700">{fmt(customerStats.outstanding)}</p>
            <p className="text-[10px] text-red-400 mt-0.5">Fatura kesilmiş</p>
          </Card>
          <Card className="p-3 bg-amber-50/50 border-amber-100">
            <p className="text-[10px] text-amber-600 font-medium">Yaklaşan</p>
            <p className="text-lg font-bold text-amber-700">{fmt(customerStats.upcoming)}</p>
            <p className="text-[10px] text-amber-400 mt-0.5">Henüz fatura kesilmedi</p>
          </Card>
          <Card className="p-3 bg-green-50/50 border-green-100">
            <p className="text-[10px] text-green-600 font-medium">Ödenen</p>
            <p className="text-lg font-bold text-green-700">{fmt(customerStats.paid)}</p>
            <p className="text-[10px] text-green-400 mt-0.5">Tamamlanan ödemeler</p>
          </Card>
        </div>

        {/* v3 FIX: Status Legend — colors and labels matching CUSTOMER_STATUS */}
        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 px-1">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Hesaplandı — fatura henüz kesilmedi</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Kesinleşti — fatura kesilecek</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Ödeme Bekliyor — fatura kesildi</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Ödendi</span>
        </div>

        {Object.keys(byProposal).length === 0 ? (
          <EmptyState icon={Wallet} title="Fatura planı yok" description="Henüz oluşturulmuş fatura planı bulunmuyor." />
        ) : (
          Object.entries(byProposal).map(([pid, group]) => (
            <Card key={pid} className="overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  Proje: {group.proposalNumber || `#${String(pid).slice(0, 8)}`}
                </h3>
              </div>
              <div className="divide-y">
                {group.plans.sort((a, b) => (a.period_start || '').localeCompare(b.period_start || '')).map(plan => {
                  const hasExtra = (plan.extra_subtotal || 0) > 0
                  return (
                    <div key={plan.id}>
                      <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                        <div className="flex items-center gap-4">
                          {expandedPlan === plan.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          <div>
                            <p className="font-medium text-sm">
                              {plan.period_label}
                              {plan.is_estimated && <span className="text-[10px] text-gray-400 ml-2 bg-gray-100 px-1.5 py-0.5 rounded" title="Teslimat bilgilerine göre kesinleşecektir">ön hesaplama</span>}
                              {plan.is_extension && <span className="text-[10px] text-orange-600 ml-2 bg-orange-50 px-1.5 py-0.5 rounded font-medium" title="Sözleşme süresi doldu, makine hala sahada">sözleşme uzaması</span>}
                            </p>
                            <p className="text-xs text-gray-500">{plan.items?.length || 0} kalem • Kesim: {fmtDate(plan.billing_date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-sm">{fmt(plan.total_amount, plan.currency)}</p>
                          </div>
                          <StatusDot status={plan.status} />
                        </div>
                      </div>
                      {expandedPlan === plan.id && (
                        <div className="px-4 pb-4 space-y-2">
                          {/* v3 FIX: Customer subtotals — added Toplam card */}
                          <div className={`grid ${hasExtra ? 'grid-cols-4' : 'grid-cols-3'} gap-2 text-xs`}>
                            <div className="p-2 bg-blue-50 rounded">
                              <p className="text-[10px] text-blue-500">Kiralama</p>
                              <p className="font-semibold text-blue-700">{fmt(plan.rental_subtotal, plan.currency)}</p>
                            </div>
                            <div className="p-2 bg-amber-50 rounded">
                              <p className="text-[10px] text-amber-500">Nakliye</p>
                              <p className="font-semibold text-amber-700">{fmt(plan.transport_subtotal, plan.currency)}</p>
                            </div>
                            {hasExtra && (
                              <div className="p-2 bg-purple-50 rounded">
                                <p className="text-[10px] text-purple-500">Ekstra</p>
                                <p className="font-semibold text-purple-700">{fmt(plan.extra_subtotal, plan.currency)}</p>
                              </div>
                            )}
                            <div className="p-2 bg-gray-100 rounded">
                              <p className="text-[10px] text-gray-500">Toplam</p>
                              <p className="font-bold text-gray-900">{fmt(plan.total_amount, plan.currency)}</p>
                            </div>
                          </div>
                          <ItemsTable plan={plan} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          ))
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // STAFF VIEW
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="p-4 lg:p-6 space-y-5">

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        {[
          { label: 'Taslak', value: stats.draft, icon: FileText, color: 'text-gray-500', filter: 'DRAFT' },
          { label: 'Planlandı', value: stats.planned, icon: Clock, color: 'text-amber-500', filter: 'PLANNED' },
          { label: 'Onaylandı', value: stats.approved, icon: CheckCircle2, color: 'text-blue-500', filter: 'APPROVED' },
          { label: 'Faturlandı', value: stats.invoiced, icon: FileText, color: 'text-emerald-500', filter: 'INVOICED' },
          { label: 'Ödendi', value: stats.paid, icon: Check, color: 'text-green-500', filter: 'PAID' },
        ].map(s => (
          <Card key={s.filter} className={`p-3 cursor-pointer transition-all ${filterStatus === s.filter ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}
            onClick={() => setFilterStatus(filterStatus === s.filter ? 'all' : s.filter)}>
            <div className="flex items-center gap-2">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
        {/* v5 FIX T1: Kesin Bekleyen (PLANNED+APPROVED) */}
        <Card className="p-3 bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-base font-bold text-blue-700">{fmt(stats.confirmedAmount)}</p>
              <p className="text-[10px] text-gray-500">Kesin Bekleyen</p>
            </div>
          </div>
        </Card>
        {/* v5 FIX T1: Tahmini (DRAFT) — sadece varsa göster */}
        {stats.draftAmount > 0 && (
          <Card className="p-3 bg-gradient-to-br from-gray-50 to-white border-dashed">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-base font-bold text-gray-400 italic">{fmt(stats.draftAmount)}</p>
                <p className="text-[10px] text-gray-400">Tahmini</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ── FILTERS ── */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Dönem</label>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#F7B500]">
              <option value="all">Tüm Dönemler</option>
              {availableMonths.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Müşteri</label>
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#F7B500]">
              <option value="all">Tüm Müşteriler</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="w-[130px]">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Tip</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#F7B500]">
              <option value="all">Hepsi</option>
              <option value="RENTAL">Kiralama</option>
              <option value="TRANSPORT">Nakliye</option>
              <option value="EXTRA">Ekstra</option>
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            {filteredPlans.filter(p => p.status === 'PLANNED').length > 0 && (
              <Button variant="success" size="sm" icon={Check} loading={bulkApproving} disabled={bulkApproving}
                onClick={async () => {
                  const planned = filteredPlans.filter(p => p.status === 'PLANNED' && (p.items?.length || 0) > 0)
                  if (planned.length === 0) { showToast('Onaylanacak plan yok', 'error'); return }
                  // v3: Estimated item warning in bulk approve
                  const hasEstimated = planned.some(p => (p.items || []).some(i => i.is_estimated_item))
                  const details = planned.map(p => `• ${p.period_label} — ${fmt(p.total_amount, p.currency)}`).join('\n')
                  const msg = hasEstimated
                    ? `⚠️ Bazı planlarda tahmini kalemler var!\n\n${planned.length} planı toplu onaylamak istediğinize emin misiniz?\n\n${details}`
                    : `${planned.length} planı toplu onaylamak istediğinize emin misiniz?\n\n${details}`
                  if (!confirm(msg)) return
                  setBulkApproving(true)
                  try {
                    for (const p of planned) {
                      await supabase.from('invoice_plans').update({
                        status: 'APPROVED', approved_at: new Date().toISOString(),
                        approved_by: user.id, is_estimated: false, updated_at: new Date().toISOString()
                      }).eq('id', p.id)
                    }
                    showToast(`${planned.length} plan onaylandı`, 'success')
                    loadData()
                  } catch (err) { showToast('Toplu onay başarısız', 'error') }
                  setBulkApproving(false)
                }}>Toplu Onayla ({filteredPlans.filter(p => p.status === 'PLANNED').length})</Button>
            )}
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={loadData} loading={checking}>Yenile</Button>
          </div>
        </div>
      </Card>

      {/* ── PLANS LIST ── */}
      {filteredPlans.length === 0 ? (
        <EmptyState icon={Wallet} title="Plan bulunamadı"
          description={filterStatus !== 'all' || filterMonth !== 'all'
            ? 'Filtre kriterlerine uygun plan yok.'
            : 'Henüz fatura planı oluşturulmamış. Sözleşme onaylandığında otomatik oluşturulur.'} />
      ) : (
        <div className="space-y-3">
          {filteredPlans.map(plan => {
            const hasExtra = (plan.extra_subtotal || 0) > 0
            return (
              <Card key={plan.id} className={`overflow-hidden ${plan.status === 'DRAFT' ? 'border-dashed border-gray-300' : ''}`}>
                {/* Plan Header */}
                <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-1 h-10 rounded-full ${PLAN_STATUS[plan.status]?.dot}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 truncate">{plan.company?.name}</span>
                          <span className="text-xs text-gray-400">{plan.proposal?.proposal_number || `#${String(plan.proposal_id || '').slice(0, 8)}`}</span>
                          {plan.is_estimated && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded" title="Teslimat bilgilerine göre kesinleşecektir">ön hesaplama</span>}
                          {plan.is_extension && <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded font-medium" title="Sözleşme süresi dolmuş, makine sahada">uzama</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium text-gray-700">{plan.period_label}</span>
                          <span className="text-[10px] text-gray-400">• {plan.items?.length || 0} kalem</span>
                          <span className="text-[10px] text-gray-400">• Kesim: {fmtDate(plan.billing_date)}</span>
                          {plan.invoice_number && <span className="text-[10px] text-emerald-600 font-medium">• Fatura: {plan.invoice_number}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-sm">{fmt(plan.total_amount, plan.currency)}</p>
                        <StatusDot status={plan.status} />
                      </div>
                      {expandedPlan === plan.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedPlan === plan.id && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-3">
                    {/* Subtotals */}
                    <div className={`grid ${hasExtra ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                      <div className="p-2.5 bg-white rounded-lg">
                        <p className="text-[10px] text-gray-500">Kiralama</p>
                        <p className="font-semibold text-blue-600 text-sm">{fmt(plan.rental_subtotal, plan.currency)}</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg">
                        <p className="text-[10px] text-gray-500">Nakliye</p>
                        <p className="font-semibold text-amber-600 text-sm">{fmt(plan.transport_subtotal, plan.currency)}</p>
                      </div>
                      {hasExtra && (
                        <div className="p-2.5 bg-white rounded-lg">
                          <p className="text-[10px] text-gray-500">Ekstra</p>
                          <p className="font-semibold text-purple-600 text-sm">{fmt(plan.extra_subtotal, plan.currency)}</p>
                        </div>
                      )}
                      <div className="p-2.5 bg-white rounded-lg">
                        <p className="text-[10px] text-gray-500">Toplam</p>
                        <p className="font-bold text-gray-900 text-sm">{fmt(plan.total_amount, plan.currency)}</p>
                      </div>
                    </div>
                    <ItemsTable plan={plan} />
                    {isAdmin && <ActionButtons plan={plan} />}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Fatura Planı Düzenle" size="lg">
        <div className="p-6 space-y-4">
          {editingPlan && <>
            <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
              <p className="text-sm"><strong>{editingPlan.company?.name}</strong> — {editingPlan.period_label}</p>
              <StatusDot status={editingPlan.status} />
            </div>
            {editingPlan.status === 'APPROVED' && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Bu plan onaylanmış durumda. Kaydettiğinizde plan "Planlandı" durumuna geri alınacak ve tekrar onay gerekecektir.</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2">Kalem</th>
                    <th className="text-center px-3 py-2 w-20">Gün</th>
                    <th className="text-right px-3 py-2 w-28">Günlük</th>
                    <th className="text-right px-3 py-2 w-28">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {editingItems.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-xs">{item.machine_type || item.description}</p>
                        {item.machine_serial && <p className="text-[10px] text-blue-600 font-mono">{item.machine_serial}</p>}
                        <p className="text-[10px] text-gray-400">{ITEM_TYPES[item.item_type]?.label}</p>
                      </td>
                      <td className="px-3 py-2">
                        {item.item_type === 'RENTAL' ? (
                          <Input type="number" value={item.billable_days ?? ''} onChange={e => updateItem(item.id, 'billable_days', e.target.value)} min={0} max={31} />
                        ) : <span className="text-gray-400 text-center block">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {item.item_type === 'RENTAL' ? (
                          <Input type="number" value={item.daily_rate ?? ''} onChange={e => updateItem(item.id, 'daily_rate', e.target.value)} step="0.01" />
                        ) : <span className="text-gray-400 text-center block">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {/* v5 FIX H7: RENTAL → read-only (gün × günlük otomatik hesap) */}
                        {item.item_type === 'RENTAL' ? (
                          <span className="text-right block font-medium text-sm text-gray-700">
                            {fmt(item.amount, editingPlan?.currency)}
                          </span>
                        ) : (
                          <Input type="number" value={item.amount ?? ''} onChange={e => updateItem(item.id, 'amount', parseFloat(e.target.value) || 0)} step="0.01" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={3} className="px-3 py-2 text-right text-xs">Toplam:</td>
                    <td className="px-3 py-2 text-right text-sm">
                      {fmt(editingItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0), editingPlan.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>İptal</Button>
              <Button variant="primary" className="flex-1" onClick={saveEdit} loading={saving}>Kaydet</Button>
            </div>
          </>}
        </div>
      </Modal>

      {/* ── ADD ITEM MODAL ── */}
      <Modal isOpen={showAddItemModal} onClose={() => setShowAddItemModal(false)} title="Kalem Ekle" size="md">
        <div className="p-6 space-y-4">
          {addItemPlan && <>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm"><strong>{addItemPlan.company?.name}</strong> — {addItemPlan.period_label}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kalem Tipi</label>
              <select value={newItem.item_type} onChange={e => setNewItem(p => ({ ...p, item_type: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#F7B500]">
                {MANUAL_TYPES.map(t => (
                  <option key={t} value={t}>{ITEM_TYPES[t].label}</option>
                ))}
              </select>
            </div>

            <Input label="Makine (opsiyonel)" placeholder="Örn: Platform 15M" value={newItem.machine_type}
              onChange={e => setNewItem(p => ({ ...p, machine_type: e.target.value }))} />

            <Input label="Açıklama" placeholder="Örn: Hidrolik hortum değişimi" value={newItem.description}
              onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} required />

            <Input label={`Tutar (${addItemPlan.currency === 'USD' ? '$' : addItemPlan.currency === 'EUR' ? '€' : '₺'})`} type="number" placeholder="0.00" value={newItem.amount}
              onChange={e => setNewItem(p => ({ ...p, amount: e.target.value }))} step="0.01" required />

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddItemModal(false)}>İptal</Button>
              <Button variant="primary" className="flex-1" onClick={saveNewItem} loading={saving} icon={Plus}>Ekle</Button>
            </div>
          </>}
        </div>
      </Modal>
    </div>
  )
}

export default InvoicePlanPage
