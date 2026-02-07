'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Wallet, Package, Plus, Edit, Trash2, Check, X,
  FileText, ChevronDown, ChevronRight, RefreshCw, Calculator,
  Clock, CheckCircle2, AlertCircle, Truck, AlertTriangle
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import EmptyState from '@/components/ui/EmptyState'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { SkeletonTable } from '@/components/ui/Skeleton'

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const PLAN_STATUS = {
  PLANNED: { label: 'Planlandı', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  APPROVED: { label: 'Onaylandı', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  INVOICED: { label: 'Fatura Kesildi', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  PAID: { label: 'Ödendi', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  CANCELLED: { label: 'İptal', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' }
}

const ITEM_TYPES = {
  RENTAL: { label: 'Kiralama', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
  TRANSPORT_DELIVERY: { label: 'Nakliye (Gidiş)', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
  TRANSPORT_RETURN: { label: 'Nakliye (Dönüş)', icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const fmt = (amount, currency = 'TRY') => {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'
  return `${sym}${(amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'

const monthKey = (date) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}

const currentMK = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

const monthRange = (startKey, endKey) => {
  const months = []
  const [sy, sm] = startKey.split('-').map(Number)
  const [ey, em] = endKey.split('-').map(Number)
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    months.push({ key, year: y, month: m, label: monthLabel(key), start: new Date(y, m - 1, 1), end: new Date(y, m, 0) })
    m++; if (m > 12) { m = 1; y++ }
    if (months.length > 24) break // safety
  }
  return months
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const InvoicePlanPage = ({ user, showToast, isAdmin }) => {
  const isCustomer = !isAdmin

  // --- DATA ---
  const [plans, setPlans] = useState([])
  const [allDeliveryItems, setAllDeliveryItems] = useState([])
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)

  // --- FILTERS ---
  const [filterMonth, setFilterMonth] = useState(currentMK())
  const [filterCompany, setFilterCompany] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // --- UI STATE ---
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [generating, setGenerating] = useState(false)

  // --- MANUAL GENERATE MODAL ---
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualProposal, setManualProposal] = useState(null)
  const [manualStart, setManualStart] = useState(currentMK())
  const [manualEnd, setManualEnd] = useState(currentMK())
  const [generateLog, setGenerateLog] = useState([])

  // --- EDIT MODAL ---
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [editingItems, setEditingItems] = useState([])
  const [saving, setSaving] = useState(false)

  // ═══════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      let plansQ = supabase.from('invoice_plans').select(`
        *, proposal:proposals(id, proposal_number, currency, quote_items),
        company:companies(id, name), items:invoice_plan_items(*)
      `).neq('status', 'CANCELLED').order('period_start', { ascending: false })

      if (isCustomer) plansQ = plansQ.eq('company_id', user.company_id)
      const { data: plansData, error: plansErr } = await plansQ
      if (plansErr) throw plansErr
      setPlans(plansData || [])

      if (!isCustomer) {
        const { data: diData } = await supabase.from('delivery_items')
          .select('*, proposal:proposals(id, proposal_number, company_id, currency, quote_items, company:companies(id, name))')
          .eq('delivery_status', 'DELIVERED')
        setAllDeliveryItems(diData || [])

        const { data: propData } = await supabase.from('proposals')
          .select('id, proposal_number, company_id, currency, quote_items, company:companies(id, name)')
          .eq('status', 'CONVERTED').order('created_at', { ascending: false })
        setProposals(propData || [])
      }
    } catch (err) {
      console.error('Load error:', err)
      showToast('Veriler yüklenemedi', 'error')
    }
    setLoading(false)
  }, [showToast, isCustomer, user?.company_id])

  useEffect(() => { loadData() }, [loadData])

  // ═══════════════════════════════════════════════════════════
  // MISSING PLAN DETECTION
  // ═══════════════════════════════════════════════════════════
  const missingPlans = useMemo(() => {
    if (isCustomer || allDeliveryItems.length === 0) return []
    const now = currentMK()
    const missing = []

    // Group by proposal
    const byProposal = {}
    for (const di of allDeliveryItems) {
      if (!di.delivery_completed_at) continue
      const pid = di.proposal_id
      if (!byProposal[pid]) byProposal[pid] = {
        items: [], proposalNumber: di.proposal?.proposal_number,
        companyName: di.proposal?.company?.name, companyId: di.proposal?.company_id,
        currency: di.proposal?.currency
      }
      byProposal[pid].items.push(di)
    }

    // Existing plan months per proposal (exclude CANCELLED)
    const existingMap = {}
    for (const p of plans) {
      if (p.status === 'CANCELLED') continue
      const key = p.proposal_id
      if (!existingMap[key]) existingMap[key] = new Set()
      existingMap[key].add(monthKey(p.period_start))
    }

    for (const [proposalId, group] of Object.entries(byProposal)) {
      let earliest = null, latest = null

      for (const di of group.items) {
        const del = new Date(di.delivery_completed_at)
        if (!earliest || del < earliest) earliest = del
        const end = di.return_completed_at ? new Date(di.return_completed_at) : new Date()
        if (!latest || end > latest) latest = end
      }
      if (!earliest) continue

      const startK = monthKey(earliest)
      const endK = monthKey(latest) > now ? now : monthKey(latest)
      const months = monthRange(startK, endK)
      const existing = existingMap[proposalId] || new Set()

      for (const mo of months) {
        if (existing.has(mo.key)) continue
        // Check if any item is active in this month
        const active = group.items.filter(di => {
          const dk = monthKey(di.delivery_completed_at)
          if (dk > mo.key) return false
          if (di.return_completed_at && monthKey(di.return_completed_at) < mo.key) return false
          return true
        })
        if (active.length > 0) {
          missing.push({
            proposalId, companyName: group.companyName, companyId: group.companyId,
            proposalNumber: group.proposalNumber, currency: group.currency,
            monthKey: mo.key, monthLabel: mo.label, itemCount: active.length
          })
        }
      }
    }
    return missing.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  }, [isCustomer, allDeliveryItems, plans])

  // ═══════════════════════════════════════════════════════════
  // BILLING CALCULATION (core logic)
  // ═══════════════════════════════════════════════════════════
  const calculateBilling = (di, pStart, pEnd, quoteItems = []) => {
    const qi = quoteItems.find(q => q.machine_type === di.machine_type) || {}
    const monthly = parseFloat(qi.rental_price || di.rental_price || 0)
    const daily = monthly / 30
    const transport = parseFloat(qi.transport_price || di.transport_price || 0)

    const delDate = di.delivery_completed_at ? new Date(di.delivery_completed_at) : null
    const retDate = di.return_completed_at ? new Date(di.return_completed_at) : null
    if (!delDate) return []

    const items = []
    let days = 0, iStart = pStart, iEnd = pEnd

    // Delivery in this month?
    if (delDate >= pStart && delDate <= pEnd) {
      iStart = delDate
      days = Math.min(Math.ceil((pEnd - delDate) / 86400000) + 1, 30)
    } else if (delDate < pStart) {
      days = 30
    }

    // Return in this month?
    if (retDate && retDate >= pStart && retDate <= pEnd) {
      iEnd = retDate
      const effStart = iStart > pStart ? iStart : pStart
      days = Math.min(Math.ceil((retDate - effStart) / 86400000) + 1, 30)
    } else if (retDate && retDate < pStart) {
      days = 0
    }

    // Rental item
    if (days > 0) {
      items.push({
        delivery_item_id: di.id, machine_type: di.machine_type,
        machine_serial: di.assigned_machine_serial, item_type: 'RENTAL',
        description: `${di.machine_type}${di.assigned_machine_serial ? ' (' + di.assigned_machine_serial + ')' : ''} — ${days} gün`,
        period_start: iStart.toISOString().split('T')[0],
        period_end: iEnd.toISOString().split('T')[0],
        total_days: 30, billable_days: days, daily_rate: daily,
        monthly_rate: monthly, amount: Math.round(daily * days * 100) / 100
      })
    }

    // Transport delivery (only in delivery month)
    if (delDate >= pStart && delDate <= pEnd && !di.transport_delivery_invoiced && transport > 0) {
      items.push({
        delivery_item_id: di.id, machine_type: di.machine_type,
        machine_serial: di.assigned_machine_serial, item_type: 'TRANSPORT_DELIVERY',
        description: `${di.machine_type} — Nakliye Gidiş`,
        amount: Math.round((transport / 2) * 100) / 100
      })
    }

    // Transport return (only in return month)
    if (retDate && retDate >= pStart && retDate <= pEnd && !di.transport_return_invoiced && transport > 0) {
      items.push({
        delivery_item_id: di.id, machine_type: di.machine_type,
        machine_serial: di.assigned_machine_serial, item_type: 'TRANSPORT_RETURN',
        description: `${di.machine_type} — Nakliye Dönüş`,
        amount: Math.round((transport / 2) * 100) / 100
      })
    }

    return items
  }

  // ═══════════════════════════════════════════════════════════
  // GENERATE PLAN FOR A SINGLE MONTH
  // ═══════════════════════════════════════════════════════════
  const generateMonth = async (proposalId, companyId, currency, diList, quoteItems, mo) => {
    const billingDate = new Date(mo.year, mo.month - 1, Math.min(30, mo.end.getDate()))
    const allItems = []
    let rental = 0, transport = 0

    for (const di of diList) {
      const items = calculateBilling(di, mo.start, mo.end, quoteItems)
      for (const item of items) {
        item.sort_order = allItems.length
        allItems.push(item)
        item.item_type === 'RENTAL' ? (rental += item.amount) : (transport += item.amount)
      }
    }

    if (allItems.length === 0) return { status: 'empty', month: mo.label }

    // Duplicate check
    const { data: exists } = await supabase.from('invoice_plans').select('id')
      .eq('proposal_id', proposalId).eq('period_start', mo.start.toISOString().split('T')[0])
      .neq('status', 'CANCELLED').maybeSingle()
    if (exists) return { status: 'duplicate', month: mo.label }

    const { data: plan, error: planErr } = await supabase.from('invoice_plans').insert({
      proposal_id: proposalId, company_id: companyId,
      billing_date: billingDate.toISOString().split('T')[0],
      period_start: mo.start.toISOString().split('T')[0],
      period_end: mo.end.toISOString().split('T')[0],
      period_label: mo.label,
      rental_subtotal: Math.round(rental * 100) / 100,
      transport_subtotal: Math.round(transport * 100) / 100,
      total_amount: Math.round((rental + transport) * 100) / 100,
      currency: currency || 'TRY', status: 'PLANNED', created_by: user.id
    }).select().single()
    if (planErr) throw planErr

    const { error: itemsErr } = await supabase.from('invoice_plan_items')
      .insert(allItems.map(i => ({ ...i, invoice_plan_id: plan.id })))
    if (itemsErr) throw itemsErr

    return { status: 'created', month: mo.label, total: Math.round((rental + transport) * 100) / 100, items: allItems.length }
  }

  // ═══════════════════════════════════════════════════════════
  // GENERATE ALL MISSING PLANS
  // ═══════════════════════════════════════════════════════════
  const generateAllMissing = async () => {
    if (missingPlans.length === 0) return
    setGenerating(true)
    try {
      const byProposal = {}
      for (const mp of missingPlans) {
        if (!byProposal[mp.proposalId]) byProposal[mp.proposalId] = []
        byProposal[mp.proposalId].push(mp)
      }
      let created = 0
      for (const [proposalId, months] of Object.entries(byProposal)) {
        const diList = allDeliveryItems.filter(d => d.proposal_id === proposalId)
        const proposal = diList[0]?.proposal
        let qi = []
        try { qi = Array.isArray(proposal?.quote_items) ? proposal.quote_items : JSON.parse(proposal?.quote_items || '[]') } catch { qi = [] }

        for (const mp of months) {
          const [y, m] = mp.monthKey.split('-').map(Number)
          const mo = { year: y, month: m, label: mp.monthLabel, start: new Date(y, m - 1, 1), end: new Date(y, m, 0) }
          const res = await generateMonth(proposalId, mp.companyId, mp.currency, diList, qi, mo)
          if (res.status === 'created') created++
        }
      }
      showToast(created > 0 ? `${created} eksik plan oluşturuldu` : 'Oluşturulacak plan bulunamadı', created > 0 ? 'success' : 'warning')
      if (created > 0) loadData()
    } catch (err) {
      console.error('Generate missing error:', err)
      showToast('Hata: ' + err.message, 'error')
    }
    setGenerating(false)
  }

  // ═══════════════════════════════════════════════════════════
  // MANUAL GENERATE (from modal)
  // ═══════════════════════════════════════════════════════════
  const generateManual = async () => {
    if (!manualProposal) { showToast('Proje seçin', 'error'); return }
    if (manualStart > manualEnd) { showToast('Başlangıç ayı bitiş ayından sonra olamaz', 'error'); return }
    setGenerating(true); setGenerateLog([])
    try {
      const proposal = proposals.find(p => p.id === manualProposal)
      if (!proposal) throw new Error('Proje bulunamadı')

      const { data: diList } = await supabase.from('delivery_items').select('*').eq('proposal_id', proposal.id).eq('delivery_status', 'DELIVERED')
      if (!diList?.length) { showToast('Bu projede teslim edilmiş makine yok', 'error'); setGenerating(false); return }

      let qi = []
      try { qi = Array.isArray(proposal.quote_items) ? proposal.quote_items : JSON.parse(proposal.quote_items || '[]') } catch { qi = [] }

      const months = monthRange(manualStart, manualEnd)
      const log = []; let created = 0
      for (const mo of months) {
        const res = await generateMonth(proposal.id, proposal.company_id, proposal.currency, diList, qi, mo)
        log.push({ month: mo.label, status: res.status, message: res.status === 'created' ? `${res.items} kalem, ${fmt(res.total, proposal.currency)}` : res.status === 'duplicate' ? 'Zaten mevcut' : 'Faturalanacak kalem yok' })
        if (res.status === 'created') created++
      }
      setGenerateLog(log)
      if (created > 0) { showToast(`${created} plan oluşturuldu`, 'success'); loadData() }
    } catch (err) {
      showToast('Hata: ' + err.message, 'error')
    }
    setGenerating(false)
  }

  // ═══════════════════════════════════════════════════════════
  // STATUS TRANSITIONS
  // ═══════════════════════════════════════════════════════════
  const changeStatus = async (plan, newStatus, confirmMsg) => {
    if (!confirm(confirmMsg)) return
    try {
      const updates = { status: newStatus, updated_at: new Date().toISOString() }
      if (newStatus === 'APPROVED') { updates.approved_at = new Date().toISOString(); updates.approved_by = user.id }
      if (newStatus === 'INVOICED') { updates.invoiced_at = new Date().toISOString(); updates.invoiced_by = user.id }
      if (newStatus === 'PAID') { updates.paid_at = new Date().toISOString() }

      const { error } = await supabase.from('invoice_plans').update(updates).eq('id', plan.id)
      if (error) throw error

      // Mark transport flags when invoiced
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
    } catch (err) {
      showToast('İşlem başarısız: ' + err.message, 'error')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════
  const deletePlan = async (plan) => {
    if (!['PLANNED', 'CANCELLED'].includes(plan.status)) {
      showToast('Sadece Planlandı veya İptal planlar silinebilir', 'error'); return
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
  // EDIT
  // ═══════════════════════════════════════════════════════════
  const openEdit = (plan) => { setEditingPlan(plan); setEditingItems(JSON.parse(JSON.stringify(plan.items || []))); setShowEditModal(true) }

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
      const a = parseFloat(i.amount)
      if (isNaN(a) || a < 0) return true
      if (i.item_type === 'RENTAL' && (parseFloat(i.billable_days) < 0 || parseFloat(i.billable_days) > 31)) return true
      return false
    })
    if (invalid) { showToast('Geçersiz değerler var (gün 0-31, tutar ≥ 0)', 'error'); return }

    setSaving(true)
    try {
      for (const item of editingItems) {
        await supabase.from('invoice_plan_items').update({
          billable_days: item.billable_days, daily_rate: item.daily_rate,
          amount: item.amount, description: item.description
        }).eq('id', item.id)
      }
      const rental = editingItems.filter(i => i.item_type === 'RENTAL').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
      const transport = editingItems.filter(i => i.item_type !== 'RENTAL').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
      await supabase.from('invoice_plans').update({
        rental_subtotal: rental, transport_subtotal: transport,
        total_amount: rental + transport, updated_at: new Date().toISOString()
      }).eq('id', editingPlan.id)

      showToast('Kaydedildi', 'success'); setShowEditModal(false); loadData()
    } catch (err) { showToast('Kayıt başarısız', 'error') }
    setSaving(false)
  }

  // ═══════════════════════════════════════════════════════════
  // COMPUTED: Filters & Stats
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
        const hasType = (p.items || []).some(i => filterType === 'RENTAL' ? i.item_type === 'RENTAL' : i.item_type !== 'RENTAL')
        if (!hasType) return false
      }
      return true
    })
  }, [plans, filterMonth, filterCompany, filterStatus, filterType])

  const stats = useMemo(() => ({
    planned: plans.filter(p => p.status === 'PLANNED').length,
    approved: plans.filter(p => p.status === 'APPROVED').length,
    invoiced: plans.filter(p => p.status === 'INVOICED').length,
    paid: plans.filter(p => p.status === 'PAID').length,
    pendingAmount: plans.filter(p => ['PLANNED', 'APPROVED'].includes(p.status)).reduce((s, p) => s + (p.total_amount || 0), 0)
  }), [plans])

  // Available months for filter
  const availableMonths = useMemo(() => {
    const set = new Set(plans.map(p => monthKey(p.period_start)))
    // Add current month
    set.add(currentMK())
    return [...set].sort().reverse().map(k => ({ key: k, label: monthLabel(k) }))
  }, [plans])

  // ═══════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════
  const StatusDot = ({ status }) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${PLAN_STATUS[status]?.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${PLAN_STATUS[status]?.dot}`} />
      {PLAN_STATUS[status]?.label}
    </span>
  )

  const ActionButtons = ({ plan }) => (
    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
      {plan.status === 'PLANNED' && <>
        <Button size="sm" variant="success" icon={Check} onClick={() => changeStatus(plan, 'APPROVED', 'Planı onaylamak istediğinize emin misiniz?')}>Onayla</Button>
        <Button size="sm" variant="outline" icon={Edit} onClick={() => openEdit(plan)}>Düzenle</Button>
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => deletePlan(plan)} className="text-red-500">Sil</Button>
      </>}
      {plan.status === 'APPROVED' && <>
        <Button size="sm" variant="primary" icon={FileText} onClick={() => changeStatus(plan, 'INVOICED', 'Fatura kesildi olarak işaretlenecek. Devam?')}>Fatura Kesildi</Button>
        <Button size="sm" variant="ghost" icon={X} onClick={() => changeStatus(plan, 'CANCELLED', 'Planı iptal etmek istediğinize emin misiniz?')} className="text-red-500">İptal</Button>
      </>}
      {plan.status === 'INVOICED' && <>
        <Button size="sm" variant="success" icon={Check} onClick={() => changeStatus(plan, 'PAID', 'Ödendi olarak işaretlenecek. Devam?')}>Ödendi</Button>
      </>}
    </div>
  )

  const ItemsTable = ({ plan, compact }) => (
    <div className="bg-white rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-3 py-2 font-medium text-gray-500">Makine</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500 hidden lg:table-cell">Dönem</th>
            <th className="text-center px-3 py-2 font-medium text-gray-500 hidden sm:table-cell">Gün</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500 hidden md:table-cell">Günlük</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">Tutar</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(plan.items || []).map(item => {
            const tc = ITEM_TYPES[item.item_type] || ITEM_TYPES.RENTAL
            const Icon = tc.icon
            return (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded ${tc.bg}`}><Icon className={`w-3.5 h-3.5 ${tc.color}`} /></div>
                    <div>
                      <p className="font-medium text-gray-900 text-xs">{item.machine_type}</p>
                      {item.machine_serial && <p className="text-[10px] text-blue-600 font-mono">{item.machine_serial}</p>}
                      <p className="text-[10px] text-gray-400">{tc.label}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 hidden lg:table-cell">
                  {item.period_start && item.period_end ? `${fmtDate(item.period_start)} — ${fmtDate(item.period_end)}` : '—'}
                </td>
                <td className="px-3 py-2 text-center text-xs hidden sm:table-cell">{item.billable_days || '—'}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-500 hidden md:table-cell">{item.daily_rate ? fmt(item.daily_rate, plan.currency) : '—'}</td>
                <td className="px-3 py-2 text-right font-medium text-sm">{fmt(item.amount, plan.currency)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t font-bold">
            <td colSpan={4} className="px-3 py-2 text-right text-xs text-gray-600 hidden sm:table-cell">TOPLAM</td>
            <td className="px-3 py-2 text-right text-xs text-gray-600 sm:hidden" colSpan={1}>TOPLAM</td>
            <td className="px-3 py-2 text-right text-sm">{fmt(plan.total_amount, plan.currency)}</td>
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
  // CUSTOMER VIEW
  // ═══════════════════════════════════════════════════════════
  if (isCustomer) {
    // Group plans by proposal
    const byProposal = {}
    plans.forEach(p => {
      const pid = p.proposal_id
      if (!byProposal[pid]) byProposal[pid] = { proposalNumber: p.proposal?.proposal_number, plans: [] }
      byProposal[pid].plans.push(p)
    })

    return (
      <div className="p-4 lg:p-6 space-y-6">
        {Object.keys(byProposal).length === 0 ? (
          <EmptyState icon={Wallet} title="Fatura planı yok" description="Henüz oluşturulmuş fatura planı bulunmuyor." />
        ) : (
          Object.entries(byProposal).map(([pid, group]) => (
            <Card key={pid} className="overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  Proje: {group.proposalNumber}
                </h3>
              </div>
              <div className="divide-y">
                {group.plans.sort((a, b) => a.period_start?.localeCompare(b.period_start)).map(plan => (
                  <div key={plan.id}>
                    <div
                      className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                    >
                      <div className="flex items-center gap-4">
                        {expandedPlan === plan.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <div>
                          <p className="font-medium text-sm">{plan.period_label}</p>
                          <p className="text-xs text-gray-500">{plan.items?.length || 0} kalem</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-sm">{fmt(plan.total_amount, plan.currency)}</p>
                          <div className="flex gap-2 text-[10px] text-gray-400">
                            <span>Kira: {fmt(plan.rental_subtotal, plan.currency)}</span>
                            {plan.transport_subtotal > 0 && <span>Nakliye: {fmt(plan.transport_subtotal, plan.currency)}</span>}
                          </div>
                        </div>
                        <StatusDot status={plan.status} />
                      </div>
                    </div>
                    {expandedPlan === plan.id && (
                      <div className="px-4 pb-4">
                        <ItemsTable plan={plan} compact />
                      </div>
                    )}
                  </div>
                ))}
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

      {/* ── MISSING PLANS BANNER ── */}
      {missingPlans.length > 0 && (
        <Card className="p-4 border-l-4 border-l-red-500 bg-red-50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">
                  {missingPlans.length} eksik fatura planı tespit edildi!
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Sahada olan ama fatura planı oluşturulmamış makineler var.
                </p>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {missingPlans.slice(0, 10).map((mp, i) => (
                    <div key={i} className="text-xs text-red-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span className="font-medium">{mp.companyName}</span>
                      <span className="text-red-500">({mp.proposalNumber})</span>
                      <span>— {mp.monthLabel} — {mp.itemCount} makine</span>
                    </div>
                  ))}
                  {missingPlans.length > 10 && <p className="text-xs text-red-500">+{missingPlans.length - 10} daha...</p>}
                </div>
              </div>
            </div>
            <Button size="sm" variant="primary" icon={Plus} onClick={generateAllMissing} loading={generating} className="flex-shrink-0">
              Tümünü Oluştur
            </Button>
          </div>
        </Card>
      )}

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Planlandı', value: stats.planned, icon: Clock, color: 'text-amber-500', filter: 'PLANNED' },
          { label: 'Onaylandı', value: stats.approved, icon: CheckCircle2, color: 'text-blue-500', filter: 'APPROVED' },
          { label: 'Faturlandı', value: stats.invoiced, icon: FileText, color: 'text-emerald-500', filter: 'INVOICED' },
          { label: 'Ödendi', value: stats.paid, icon: Check, color: 'text-green-500', filter: 'PAID' },
        ].map(s => (
          <Card key={s.filter} className={`p-3 cursor-pointer transition-all ${filterStatus === s.filter ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}
            onClick={() => setFilterStatus(filterStatus === s.filter ? 'all' : s.filter)}>
            <div className="flex items-center gap-2">
              <s.icon className={`w-6 h-6 ${s.color}`} />
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
        <Card className="p-3 col-span-2 lg:col-span-1 bg-gradient-to-br from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <Calculator className="w-6 h-6 text-gray-600" />
            <div>
              <p className="text-base font-bold">{fmt(stats.pendingAmount)}</p>
              <p className="text-[10px] text-gray-500">Bekleyen Tutar</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── FILTERS + ACTIONS ── */}
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
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={loadData}>Yenile</Button>
            <Button size="sm" icon={Plus} onClick={() => { setShowManualModal(true); setGenerateLog([]) }}>Manuel Plan</Button>
          </div>
        </div>
      </Card>

      {/* ── PLANS LIST ── */}
      {filteredPlans.length === 0 ? (
        <EmptyState icon={Wallet} title="Plan bulunamadı" description={filterStatus !== 'all' || filterMonth !== 'all' ? 'Filtre kriterlerine uygun plan yok. Filtreleri değiştirin.' : 'Henüz fatura planı oluşturulmamış.'} />
      ) : (
        <div className="space-y-3">
          {filteredPlans.map(plan => (
            <Card key={plan.id} className="overflow-hidden">
              {/* Plan Header */}
              <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1 h-10 rounded-full ${PLAN_STATUS[plan.status]?.dot}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 truncate">{plan.company?.name}</span>
                        <span className="text-xs text-gray-400">{plan.proposal?.proposal_number}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-gray-700">{plan.period_label}</span>
                        <span className="text-[10px] text-gray-400">• {plan.items?.length || 0} kalem</span>
                        <span className="text-[10px] text-gray-400">• Kesim: {fmtDate(plan.billing_date)}</span>
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

              {/* Expanded */}
              {expandedPlan === plan.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-3">
                  {/* Subtotals */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2.5 bg-white rounded-lg"><p className="text-[10px] text-gray-500">Kiralama</p><p className="font-semibold text-blue-600 text-sm">{fmt(plan.rental_subtotal, plan.currency)}</p></div>
                    <div className="p-2.5 bg-white rounded-lg"><p className="text-[10px] text-gray-500">Nakliye</p><p className="font-semibold text-amber-600 text-sm">{fmt(plan.transport_subtotal, plan.currency)}</p></div>
                    <div className="p-2.5 bg-white rounded-lg"><p className="text-[10px] text-gray-500">Toplam</p><p className="font-bold text-gray-900 text-sm">{fmt(plan.total_amount, plan.currency)}</p></div>
                  </div>
                  <ItemsTable plan={plan} />
                  <ActionButtons plan={plan} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ── MANUAL GENERATE MODAL ── */}
      <Modal isOpen={showManualModal} onClose={() => { setShowManualModal(false); setManualProposal(null); setGenerateLog([]) }} title="Manuel Fatura Planı Oluştur" size="md">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Seçilen proje ve dönem aralığı için fatura planları oluşturulur. Her ay için ayrı plan oluşur.</p>

          <SearchableSelect
            label="Proje"
            placeholder="Proje seçin..."
            options={proposals.map(p => ({ value: p.id, label: `${p.proposal_number} — ${p.company?.name || ''}` }))}
            value={manualProposal}
            onChange={v => { setManualProposal(v); setGenerateLog([]) }}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Başlangıç</label>
              <input type="month" value={manualStart} onChange={e => { setManualStart(e.target.value); if (e.target.value > manualEnd) setManualEnd(e.target.value); setGenerateLog([]) }}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#F7B500] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bitiş</label>
              <input type="month" value={manualEnd} onChange={e => { setManualEnd(e.target.value); setGenerateLog([]) }} min={manualStart}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#F7B500] focus:border-transparent" />
            </div>
          </div>

          {manualStart && manualEnd && manualStart <= manualEnd && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800"><strong>{monthRange(manualStart, manualEnd).length} ay</strong> için plan oluşturulacak. Mevcut planlar atlanır.</p>
            </div>
          )}

          {generateLog.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-700">Sonuç:</p>
              {generateLog.map((l, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${l.status === 'created' ? 'bg-emerald-50 text-emerald-700' : l.status === 'duplicate' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                  <span className="flex items-center gap-1.5">
                    {l.status === 'created' ? <CheckCircle2 className="w-3.5 h-3.5" /> : l.status === 'duplicate' ? <AlertCircle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    {l.month}
                  </span>
                  <span>{l.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setShowManualModal(false); setGenerateLog([]) }}>
              {generateLog.length > 0 ? 'Kapat' : 'İptal'}
            </Button>
            {generateLog.length === 0 && (
              <Button variant="primary" className="flex-1" onClick={generateManual} loading={generating} disabled={!manualProposal} icon={Calculator}>
                Hesapla ve Oluştur
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ── EDIT MODAL ── */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Fatura Planı Düzenle" size="lg">
        <div className="p-6 space-y-4">
          {editingPlan && <>
            <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
              <p className="text-sm"><strong>{editingPlan.company?.name}</strong> — {editingPlan.period_label}</p>
              <StatusDot status={editingPlan.status} />
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
                        <p className="font-medium text-xs">{item.machine_type}</p>
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
                        <Input type="number" value={item.amount ?? ''} onChange={e => updateItem(item.id, 'amount', parseFloat(e.target.value) || 0)} step="0.01" />
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
    </div>
  )
}

export default InvoicePlanPage
