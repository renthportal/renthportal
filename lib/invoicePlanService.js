// ═══════════════════════════════════════════════════════════════
// lib/invoicePlanService.js  v5  — Final Audit Düzeltmeleri
// v4: K1 ay-sonu, K2 Feb28, K3 transport, L1 duplicate
// v5: F8 timezone-safe parse, H2 planIsEstimated+manuel,
//     H5 frozen plan uyarısı, T4 Şubat açıklama
// ═══════════════════════════════════════════════════════════════
import { supabase } from '@/lib/supabase'

// ─── DATE HELPERS (timezone-safe) ────────────────────────────

/** Local date string without UTC shift — YYYY-MM-DD
 *  v5 FIX F8: "YYYY-MM-DD" string doğrudan parse — new Date("2026-01-15")
 *  UTC midnight olarak yorumlanıp UTC- bölgelerde gün kayması riskini önler
 */
const toDateStr = (d) => {
  if (!d) return null
  if (typeof d === 'string') {
    // YYYY-MM-DD formatı zaten varsa, doğrudan döndür
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
    d = new Date(d)
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Strip time from Date — all calculations use midnight-local
 *  v5 FIX F8: "YYYY-MM-DD" string → local Date, UTC kaymayı önler
 */
const stripTime = (d) => {
  if (!d) return null
  if (typeof d === 'string') {
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return new Date(+match[1], +match[2] - 1, +match[3])
    d = new Date(d)
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Month key: "2026-02" */
const monthKey = (date) => {
  if (!date) return null
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const currentMK = () => monthKey(new Date())

/** Human-readable: "Şubat 2026" */
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}

/** Generate array of month objects from startKey to endKey (inclusive) */
const monthRange = (startKey, endKey) => {
  const months = []
  const [sy, sm] = startKey.split('-').map(Number)
  const [ey, em] = endKey.split('-').map(Number)
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    months.push({
      key, year: y, month: m,
      label: monthLabel(key),
      start: new Date(y, m - 1, 1),
      end: new Date(y, m, 0) // last day of month
    })
    m++
    if (m > 12) { m = 1; y++ }
    if (months.length > 36) break // safety: max 3 yıl
  }
  return months
}

/** Count days between two dates (inclusive: both start and end counted)
 *  Jan 15 → Jan 31 = 17 gün, Jan 20 → Jan 20 = 1 gün (min fatura)
 */
const daysBetween = (from, to) => {
  const a = stripTime(from), b = stripTime(to)
  if (!a || !b || b < a) return 0
  return Math.round((b - a) / 86400000) + 1
}

// ─── RATE CALCULATIONS ──────────────────────────────────────

/** Daily rate based on period type
 *  Ay: net / 30, Hafta: net / 7, Gün: net / 1
 */
const calcDailyRate = (rentalPrice, rentalDiscount, period) => {
  const net = (parseFloat(rentalPrice) || 0) - (parseFloat(rentalDiscount) || 0)
  if (net <= 0) return 0
  switch (period) {
    case 'Gün': return net
    case 'Hafta': return net / 7
    case 'Ay':
    default: return net / 30
  }
}

/** Half of net transport price (gidiş = dönüş = toplam/2) */
const calcTransportHalf = (transportPrice, transportDiscount) => {
  const net = (parseFloat(transportPrice) || 0) - (parseFloat(transportDiscount) || 0)
  return net > 0 ? net / 2 : 0
}

/** Calculate contract end date from start + duration + period
 *  "2 Ay" from Jan 15 = Mar 14 (inclusive)
 *  "1 Ay" from Jan 31 = Feb 28 (last day of Feb, month-end safe)
 *  "1 Ay" from Feb 28 (non-leap) = Mar 27 (normal tarih olarak işlenir)
 *  "1 Ay" from Feb 29 (leap) = Mar 31 (ay-sonu: hedef ayın son günü)
 *  "3 Hafta" from Jan 15 = Feb 4 (inclusive)
 *  "5 Gün" from Jan 15 = Jan 19 (inclusive)
 *
 *  AY-SONU KURALI v4:
 *  Sadece origDay >= 29 VE ayın son günü ise "ay-sonu" sayılır.
 *  Feb 28 non-leap yılda → normal tarih (28. gün)
 *  Feb 29 leap yılda → ay-sonu
 */
const calcContractEnd = (startDate, duration, period) => {
  if (!startDate || !duration) return null
  const d = new Date(startDate)
  switch (period) {
    case 'Gün':
      d.setDate(d.getDate() + duration - 1)
      break
    case 'Hafta':
      d.setDate(d.getDate() + (duration * 7) - 1)
      break
    case 'Ay':
    default: {
      // v4 FIX K1+K2: Ay-sonu güvenliği
      const origDay = d.getDate()
      const daysInStartMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()

      // Ay-sonu tespiti:
      // Feb 28 non-leap: 28===28 ama origDay<29 → normal tarih
      // Feb 29 leap: 29===29 ve origDay>=29 → ay-sonu ✓
      // Jan 31: 31===31 ve origDay>=29 → ay-sonu ✓
      // Apr 30: 30===30 ve origDay>=29 → ay-sonu ✓
      const isLastDayOfMonth = (origDay === daysInStartMonth) && (origDay >= 29)

      d.setDate(1) // overflow'u önlemek için 1'e git
      d.setMonth(d.getMonth() + duration)

      if (isLastDayOfMonth) {
        // Başlangıç ayın son günüyse → bitiş de hedef ayın son günü
        // Jan 31 + 1 Ay = Feb 28, Mar 31 + 1 Ay = Apr 30
        // v4: -1 YOK! Ay-sonu → ay-sonu (tam ay garantisi)
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        d.setDate(lastDay)
      } else {
        // Normal: aynı gün → -1
        // Jan 15 + 1 Ay → Feb 15 → -1 → Feb 14
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        d.setDate(Math.min(origDay, lastDay))
        d.setDate(d.getDate() - 1)
      }
      break
    }
  }
  return stripTime(d)
}

// ═══════════════════════════════════════════════════════════════
// CORE: Calculate billing items for ONE machine in ONE month
// ═══════════════════════════════════════════════════════════════

const calcMachineMonth = (di, moStart, moEnd, isEstimated = false) => {
  const daily = calcDailyRate(di.rental_price, di.rental_discount, di.period)
  const transportHalf = calcTransportHalf(di.transport_price, di.transport_discount)

  // ── Determine effective start date ──
  const rawStart = di.delivery_completed_at || di.estimated_start
  if (!rawStart) return []
  const delDate = stripTime(rawStart)

  // ── Determine effective end date ──
  const contractEnd = calcContractEnd(
    di.delivery_completed_at || di.estimated_start,
    di.duration, di.period
  )

  let retDate = null
  if (di.return_completed_at) {
    retDate = stripTime(di.return_completed_at)
  } else if (!di.delivery_completed_at && di.estimated_end) {
    retDate = stripTime(di.estimated_end)
  }

  // ── Is this machine relevant in this month? ──
  // Machine hasn't started yet
  if (delDate > moEnd) return []

  // Machine already returned before this month
  if (retDate && retDate < moStart) return []

  // For ESTIMATED (DRAFT) plans only:
  // If contract ended before this month AND no return date → skip
  // (actual/delivered machines without return → ALWAYS active, uzama olarak devam)
  if (isEstimated && !retDate && contractEnd && contractEnd < moStart) return []

  // ── Calculate billable days ──
  const periodStart = delDate > moStart ? delDate : moStart

  // endDate logic:
  //   Returned → return date
  //   Estimated (DRAFT), contract ended within month → contract end
  //   Actual (delivered, no return) → moEnd (machine is on-site, full month)
  let periodEnd
  if (retDate && retDate <= moEnd) {
    periodEnd = retDate
  } else if (isEstimated && contractEnd && contractEnd <= moEnd) {
    periodEnd = contractEnd
  } else {
    periodEnd = moEnd
  }

  // Guard: invalid period
  if (periodEnd < periodStart) return []

  // ── Full Month = 30 gün, Partial = gerçek gün (max 30) ──
  // "Sabit 30'a böl" kuralı: Tam ay çalışan makine → 30 gün fatura
  // Şubat 28 gün olsa bile tam ay = 30 gün
  const isFullMonth = (periodStart.getTime() === moStart.getTime() && periodEnd.getTime() === moEnd.getTime())
  const days = isFullMonth ? 30 : Math.min(daysBetween(periodStart, periodEnd), 30)
  if (days <= 0) return []

  const items = []
  const label = `${di.machine_type}${di.assigned_machine_serial ? ' (' + di.assigned_machine_serial + ')' : ''}`

  // ── RENTAL item ──
  items.push({
    delivery_item_id: di.id,
    machine_type: di.machine_type,
    machine_serial: di.assigned_machine_serial || null,
    item_type: 'RENTAL',
    description: `${label} — ${days} gün${isFullMonth ? ' (tam ay — aylık sabit)' : ''}${isEstimated ? ' (ön hesaplama)' : ''}`,
    period_start: toDateStr(periodStart),
    period_end: toDateStr(periodEnd),
    total_days: 30,
    billable_days: days,
    daily_rate: Math.round(daily * 100) / 100,
    monthly_rate: (parseFloat(di.rental_price) || 0) - (parseFloat(di.rental_discount) || 0),
    amount: Math.round(daily * days * 100) / 100,
    is_auto: true,
    is_estimated_item: isEstimated
  })

  // ── TRANSPORT DELIVERY (only in delivery month, once) ──
  if (delDate >= moStart && delDate <= moEnd && !di.transport_delivery_invoiced && transportHalf > 0) {
    items.push({
      delivery_item_id: di.id,
      machine_type: di.machine_type,
      machine_serial: di.assigned_machine_serial || null,
      item_type: 'TRANSPORT_DELIVERY',
      description: `${label} — Nakliye Gidiş`,
      amount: Math.round(transportHalf * 100) / 100,
      is_auto: true
    })
  }

  // ── TRANSPORT RETURN (only in ACTUAL return month, never on estimated/contract end) ──
  const actualReturn = di.return_completed_at ? stripTime(di.return_completed_at) : null
  if (actualReturn && actualReturn >= moStart && actualReturn <= moEnd
      && !di.transport_return_invoiced && transportHalf > 0) {
    items.push({
      delivery_item_id: di.id,
      machine_type: di.machine_type,
      machine_serial: di.assigned_machine_serial || null,
      item_type: 'TRANSPORT_RETURN',
      description: `${label} — Nakliye Dönüş`,
      amount: Math.round(transportHalf * 100) / 100,
      is_auto: true
    })
  }

  return items
}

// ═══════════════════════════════════════════════════════════════
// DETERMINE MONTH RANGE for a delivery item
// ═══════════════════════════════════════════════════════════════

const getItemMonthRange = (di) => {
  const startDate = di.delivery_completed_at || di.estimated_start
  if (!startDate) return { startKey: null, endKey: null }

  const startKey = monthKey(startDate)
  let endDate

  if (di.return_completed_at) {
    // Returned → end at return month
    endDate = di.return_completed_at
  } else if (di.delivery_completed_at) {
    // Delivered, not returned → extend to max(contractEnd, currentMonth)
    // Bu sayede uzama ayları da kapsanır
    const contractEnd = calcContractEnd(di.delivery_completed_at, di.duration, di.period)
    const nowStr = toDateStr(new Date())
    const ceStr = contractEnd ? toDateStr(contractEnd) : nowStr
    endDate = ceStr > nowStr ? ceStr : nowStr
  } else {
    // Not yet delivered → use estimated_end or calculated end
    endDate = di.estimated_end || toDateStr(calcContractEnd(di.estimated_start, di.duration, di.period))
  }

  if (!endDate) return { startKey, endKey: startKey }
  return { startKey, endKey: monthKey(endDate) }
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

export const invoicePlanService = {

  // ─── 1. CONTRACT CREATED → DRAFT plans ─────────────────────
  async onContractCreated(proposalId, userId) {
    const { data: proposal } = await supabase.from('proposals')
      .select('id, company_id, currency').eq('id', proposalId).single()
    if (!proposal) throw new Error('Proje bulunamadı')

    const { data: diList } = await supabase.from('delivery_items')
      .select('*').eq('proposal_id', proposalId)
    if (!diList?.length) return { created: 0, message: 'Teslimat kalemi yok' }

    return await this._generatePlans(proposal, diList, userId, 'DRAFT')
  },

  // ─── 2. DELIVERY COMPLETED → update plans ─────────────────
  async onDeliveryCompleted(deliveryItemId, userId) {
    const { data: di } = await supabase.from('delivery_items')
      .select('*, proposal:proposals(id, company_id, currency)')
      .eq('id', deliveryItemId).single()
    if (!di?.proposal) throw new Error('Teslimat kalemi bulunamadı')

    const { data: allDi } = await supabase.from('delivery_items')
      .select('*').eq('proposal_id', di.proposal_id)

    return await this._recalculate(di.proposal, allDi, userId)
  },

  // ─── 3. RETURN COMPLETED → update + warn ──────────────────
  async onReturnCompleted(deliveryItemId, userId) {
    const { data: di } = await supabase.from('delivery_items')
      .select('*, proposal:proposals(id, company_id, currency)')
      .eq('id', deliveryItemId).single()
    if (!di?.proposal) throw new Error('Teslimat kalemi bulunamadı')

    // Early return detection
    let earlyReturn = false
    let earlyReturnInfo = null
    if (di.return_completed_at && di.delivery_completed_at) {
      const contractEnd = calcContractEnd(di.delivery_completed_at, di.duration, di.period)
      if (contractEnd && stripTime(di.return_completed_at) < contractEnd) {
        earlyReturn = true
        earlyReturnInfo = {
          machine: di.machine_type,
          serial: di.assigned_machine_serial,
          returnDate: di.return_completed_at,
          contractEnd: toDateStr(contractEnd)
        }
      }
    }

    const { data: allDi } = await supabase.from('delivery_items')
      .select('*').eq('proposal_id', di.proposal_id)

    const result = await this._recalculate(di.proposal, allDi, userId)
    result.earlyReturn = earlyReturn
    result.earlyReturnInfo = earlyReturnInfo

    // Check if APPROVED/INVOICED plans are affected by this return
    const returnMK = monthKey(di.return_completed_at)
    const { data: frozenPlans } = await supabase.from('invoice_plans')
      .select('id, status, period_label, period_start, proposal_id')
      .eq('proposal_id', di.proposal_id)
      .in('status', ['APPROVED', 'INVOICED'])

    const affected = (frozenPlans || []).filter(p => {
      const pmk = monthKey(p.period_start)
      return pmk >= returnMK
    })
    if (affected.length > 0) {
      result.approvedWarning = affected.map(p =>
        `${p.period_label} (${p.status === 'APPROVED' ? 'Onaylanmış' : 'Faturlanmış'})`
      )
    }

    // v4 FIX K3: TRANSPORT_RETURN kayıp önleme
    // Eğer iade ayının planı INVOICED ise, nakliye dönüş hiçbir plana eklenemez.
    // Bu durumda: iade ayında DRAFT/PLANNED plan varsa oraya eklenmiş olur (_recalculate ile).
    // Yoksa: INVOICED plan var demek → nakliye dönüş "askıda" kalır.
    // Çözüm: Askıda kalan nakliye dönüşler için bilgi döndür.
    const transportHalf = calcTransportHalf(di.transport_price, di.transport_discount)
    if (transportHalf > 0 && !di.transport_return_invoiced) {
      // İade ayındaki planı kontrol et
      const returnMonthPlan = (frozenPlans || []).find(p => {
        const pmk = monthKey(p.period_start)
        return pmk === returnMK && ['INVOICED', 'PAID'].includes(p.status)
      })

      if (returnMonthPlan) {
        // İade ayı planı zaten faturalanmış → nakliye dönüş eklenemedi
        result.pendingTransportReturn = {
          deliveryItemId: di.id,
          machine: di.machine_type,
          serial: di.assigned_machine_serial,
          amount: Math.round(transportHalf * 100) / 100,
          returnDate: di.return_completed_at,
          affectedPlanId: returnMonthPlan.id,
          affectedPlanLabel: returnMonthPlan.period_label,
          message: `${di.machine_type} nakliye dönüş bedeli (${Math.round(transportHalf * 100) / 100}) ` +
            `${returnMonthPlan.period_label} planına eklenemedi (plan zaten faturalanmış). ` +
            `Fatura Planı sayfasından ilgili plana manuel "Kalem Ekle" yapın.`
        }
      }
    }

    return result
  },

  // ─── 4. CHECK EXTENSIONS (page load, staff only) ──────────
  async checkExtensions() {
    // Find all delivered but not returned machines
    const { data: activeDi } = await supabase.from('delivery_items')
      .select('*, proposal:proposals(id, company_id, currency)')
      .eq('delivery_status', 'DELIVERED')
      .is('return_completed_at', null)
      .not('delivery_completed_at', 'is', null)

    if (!activeDi?.length) return { extensions: 0 }

    // Group by proposal
    const byProposal = {}
    for (const di of activeDi) {
      if (!di.proposal) continue
      if (!byProposal[di.proposal_id]) {
        byProposal[di.proposal_id] = { proposal: di.proposal, items: [] }
      }
      byProposal[di.proposal_id].items.push(di)
    }

    const results = []
    const cmk = currentMK()

    for (const [proposalId, group] of Object.entries(byProposal)) {
      // Check if any machine's contract has expired
      const expired = group.items.filter(di => {
        const ce = calcContractEnd(di.delivery_completed_at, di.duration, di.period)
        return ce && new Date() > ce
      })
      if (expired.length === 0) continue

      // FIX: Use .limit(1) instead of .maybeSingle()
      const { data: existing } = await supabase.from('invoice_plans')
        .select('id').eq('proposal_id', proposalId)
        .gte('period_start', `${cmk}-01`)
        .neq('status', 'CANCELLED')
        .limit(1)

      if (existing?.length > 0) continue

      // Missing plan for current month → recalculate (will create extension)
      const allDi = await supabase.from('delivery_items')
        .select('*').eq('proposal_id', proposalId).then(r => r.data || [])

      await this._recalculate(group.proposal, allDi, null)
      results.push({
        proposalId,
        machines: expired.map(d => d.machine_type),
        isExtension: true
      })
    }

    return { extensions: results.length, details: results }
  },

  // ─── 5. MANUAL RECALCULATE (admin triggered) ─────────────
  // v3 NEW: Admin'in "Yeniden Hesapla" butonu ile tetikleyeceği fonksiyon
  async recalculateProposal(proposalId, userId) {
    const { data: proposal } = await supabase.from('proposals')
      .select('id, company_id, currency').eq('id', proposalId).single()
    if (!proposal) throw new Error('Proje bulunamadı')

    const { data: allDi } = await supabase.from('delivery_items')
      .select('*').eq('proposal_id', proposalId)
    if (!allDi?.length) return { updated: 0, created: 0, cancelled: 0, message: 'Teslimat kalemi yok' }

    return await this._recalculate(proposal, allDi, userId)
  },

  // ═══════════════════════════════════════════════════════════
  // INTERNAL: Generate fresh DRAFT plans (contract creation)
  // ═══════════════════════════════════════════════════════════
  async _generatePlans(proposal, diList, userId, defaultStatus = 'DRAFT') {
    let allStartKey = null, allEndKey = null
    for (const di of diList) {
      const { startKey, endKey } = getItemMonthRange(di)
      if (!startKey) continue
      if (!allStartKey || startKey < allStartKey) allStartKey = startKey
      if (!allEndKey || endKey > allEndKey) allEndKey = endKey
    }
    if (!allStartKey || !allEndKey) return { created: 0 }

    const months = monthRange(allStartKey, allEndKey)
    let created = 0
    const isEstimated = defaultStatus === 'DRAFT'

    for (const mo of months) {
      // Duplicate check (handle re-runs safely)
      const { data: exists } = await supabase.from('invoice_plans')
        .select('id').eq('proposal_id', proposal.id)
        .eq('period_start', toDateStr(mo.start))
        .neq('status', 'CANCELLED').limit(1)
      if (exists?.length > 0) continue

      const allItems = []
      let rental = 0, transport = 0

      for (const di of diList) {
        const items = calcMachineMonth(di, mo.start, mo.end, isEstimated)
        for (const item of items) {
          item.sort_order = allItems.length
          allItems.push(item)
          if (item.item_type === 'RENTAL') rental += item.amount
          else transport += item.amount
        }
      }
      if (allItems.length === 0) continue

      // Billing date: ayın 30'u (veya son günü kısa aylarda)
      const billingDate = new Date(mo.year, mo.month - 1, Math.min(30, mo.end.getDate()))

      const { data: plan, error: planErr } = await supabase.from('invoice_plans').insert({
        proposal_id: proposal.id,
        company_id: proposal.company_id,
        billing_date: toDateStr(billingDate),
        period_start: toDateStr(mo.start),
        period_end: toDateStr(mo.end),
        period_label: mo.label,
        rental_subtotal: Math.round(rental * 100) / 100,
        transport_subtotal: Math.round(transport * 100) / 100,
        extra_subtotal: 0,
        total_amount: Math.round((rental + transport) * 100) / 100,
        currency: proposal.currency || 'TRY',
        status: defaultStatus,
        is_estimated: isEstimated,
        created_by: userId
      }).select().single()

      if (planErr) { console.error('Plan insert error:', planErr); continue }

      await supabase.from('invoice_plan_items').insert(
        allItems.map(i => ({ ...i, invoice_plan_id: plan.id }))
      )
      created++
    }

    return { created, months: months.length }
  },

  // ═══════════════════════════════════════════════════════════
  // INTERNAL: Recalculate plans for a proposal
  // ─ Protects APPROVED/INVOICED/PAID (never auto-modify)
  // ─ Keeps manual items (SERVICE, DAMAGE, etc.)
  // ─ Only modifies DRAFT and PLANNED
  // ═══════════════════════════════════════════════════════════
  async _recalculate(proposal, diList, userId) {
    if (!proposal) return { updated: 0, created: 0, cancelled: 0 }

    // Get existing plans with items
    const { data: existingPlans } = await supabase.from('invoice_plans')
      .select('*, items:invoice_plan_items(*)')
      .eq('proposal_id', proposal.id)
      .neq('status', 'CANCELLED')
      .order('period_start')

    // Determine which months SHOULD exist
    let allStartKey = null, allEndKey = null
    for (const di of diList) {
      const { startKey, endKey } = getItemMonthRange(di)
      if (!startKey) continue
      if (!allStartKey || startKey < allStartKey) allStartKey = startKey
      if (!allEndKey || endKey > allEndKey) allEndKey = endKey
    }
    if (!allStartKey || !allEndKey) return { updated: 0, created: 0, cancelled: 0 }

    const shouldExistMonths = monthRange(allStartKey, allEndKey)
    const processedKeys = new Set()

    const AUTO_TYPES = ['RENTAL', 'TRANSPORT_DELIVERY', 'TRANSPORT_RETURN']
    let updated = 0, created = 0, cancelled = 0
    const skippedFrozen = []

    const hasAnyActualDelivery = diList.some(d => d.delivery_completed_at)

    // ── Process existing plans ──
    for (const plan of (existingPlans || [])) {
      const planMK = monthKey(plan.period_start)
      const shouldExist = shouldExistMonths.some(m => m.key === planMK)

      // Plan for a month that should no longer exist (early return)
      if (!shouldExist) {
        if (['DRAFT', 'PLANNED'].includes(plan.status)) {
          const manualItems = (plan.items || []).filter(i => !AUTO_TYPES.includes(i.item_type))
          // Auto kalemleri sil
          await supabase.from('invoice_plan_items').delete()
            .eq('invoice_plan_id', plan.id)
            .in('item_type', AUTO_TYPES)

          const manualTotal = manualItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

          if (manualItems.length > 0) {
            // FIX K2: Manuel kalem varken planı İPTAL ETME — PLANNED tut
            // Aksi halde SERVICE/DAMAGE/OPERATOR kalemleri kaybolur
            await supabase.from('invoice_plans').update({
              status: 'PLANNED',
              rental_subtotal: 0, transport_subtotal: 0,
              extra_subtotal: Math.round(manualTotal * 100) / 100,
              total_amount: Math.round(manualTotal * 100) / 100,
              is_estimated: false,
              updated_at: new Date().toISOString()
            }).eq('id', plan.id)
            skippedFrozen.push({
              planId: plan.id,
              period: plan.period_label,
              reason: `Kiralama kalemleri silindi, ${manualItems.length} manuel kalem korundu (₺${manualTotal.toLocaleString('tr-TR')})`
            })
            updated++
          } else {
            // Manuel kalem yoksa → güvenle iptal et
            await supabase.from('invoice_plan_items').delete().eq('invoice_plan_id', plan.id)
            await supabase.from('invoice_plans').update({
              status: 'CANCELLED',
              rental_subtotal: 0, transport_subtotal: 0,
              extra_subtotal: 0,
              total_amount: 0,
              updated_at: new Date().toISOString()
            }).eq('id', plan.id)
            cancelled++
          }
        }
        // APPROVED/INVOICED/PAID → don't touch (warning handled in onReturnCompleted)
        // v5 FIX: Raporla — admin recalculate'de de görsün
        if (['APPROVED', 'INVOICED', 'PAID'].includes(plan.status)) {
          skippedFrozen.push({
            planId: plan.id,
            period: plan.period_label,
            status: plan.status,
            amount: plan.total_amount,
            reason: `${plan.status} — bu ay artık sözleşme kapsamında değil ama plan donmuş durumda`
          })
        }
        processedKeys.add(planMK)
        continue
      }

      // FIX BUG 2: Skip APPROVED/INVOICED/PAID — never auto-modify frozen plans
      // v5 FIX H5: Frozen planları skippedFrozen'a raporla
      if (['APPROVED', 'INVOICED', 'PAID'].includes(plan.status)) {
        skippedFrozen.push({
          planId: plan.id,
          period: plan.period_label,
          status: plan.status,
          amount: plan.total_amount,
          reason: `${plan.status} — otomatik güncelleme yapılamaz`
        })
        processedKeys.add(planMK)
        continue
      }

      // ── Recalculate DRAFT or PLANNED plan ──
      const mo = shouldExistMonths.find(m => m.key === planMK)
      if (!mo) { processedKeys.add(planMK); continue }

      // Keep manual items (SERVICE, DAMAGE, OPERATOR, EXTRA)
      const manualItems = (plan.items || []).filter(i => !AUTO_TYPES.includes(i.item_type))
      const manualTotal = manualItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

      // Delete old auto items only
      await supabase.from('invoice_plan_items').delete()
        .eq('invoice_plan_id', plan.id)
        .in('item_type', AUTO_TYPES)

      // Recalculate auto items
      const allItems = []
      let rental = 0, transport = 0

      for (const di of diList) {
        const isItemEstimated = !di.delivery_completed_at
        const items = calcMachineMonth(di, mo.start, mo.end, isItemEstimated)
        for (const item of items) {
          item.sort_order = manualItems.length + allItems.length
          item.invoice_plan_id = plan.id
          allItems.push(item)
          if (item.item_type === 'RENTAL') rental += item.amount
          else transport += item.amount
        }
      }

      // Insert new auto items
      if (allItems.length > 0) {
        await supabase.from('invoice_plan_items').insert(allItems)
      }

      // Status: DRAFT → PLANNED when THIS month has actual delivery data
      let newStatus = plan.status
      if (plan.status === 'DRAFT' && hasAnyActualDelivery) {
        const thisMonthHasActual = allItems.some(i =>
          i.item_type === 'RENTAL' && !i.is_estimated_item
        )
        if (thisMonthHasActual) newStatus = 'PLANNED'
      }

      // Detect extension month
      const isExtension = diList.some(di => {
        if (!di.delivery_completed_at) return false
        const ce = calcContractEnd(di.delivery_completed_at, di.duration, di.period)
        return ce && mo.start > ce
      })

      // Plan-level estimated flag
      // v5 FIX H2: Manuel kalem (DAMAGE, SERVICE vb.) varsa plan tahmini DEĞİLDİR
      const planIsEstimated = manualItems.length === 0 &&
        (allItems.length === 0 || allItems.every(i => i.is_estimated_item === true))

      await supabase.from('invoice_plans').update({
        rental_subtotal: Math.round(rental * 100) / 100,
        transport_subtotal: Math.round(transport * 100) / 100,
        extra_subtotal: Math.round(manualTotal * 100) / 100,
        total_amount: Math.round((rental + transport + manualTotal) * 100) / 100,
        status: newStatus,
        is_estimated: planIsEstimated,
        is_extension: isExtension,
        updated_at: new Date().toISOString()
      }).eq('id', plan.id)

      updated++
      processedKeys.add(planMK)
    }

    // ── Create plans for months that don't have one yet ──
    for (const mo of shouldExistMonths) {
      if (processedKeys.has(mo.key)) continue

      // v4 FIX L2: Duplicate plan kontrolü (race condition önleme)
      const { data: existCheck } = await supabase.from('invoice_plans')
        .select('id').eq('proposal_id', proposal.id)
        .eq('period_start', toDateStr(mo.start))
        .neq('status', 'CANCELLED').limit(1)
      if (existCheck?.length > 0) continue

      const allItems = []
      let rental = 0, transport = 0

      for (const di of diList) {
        const isItemEstimated = !di.delivery_completed_at
        const items = calcMachineMonth(di, mo.start, mo.end, isItemEstimated)
        for (const item of items) {
          item.sort_order = allItems.length
          allItems.push(item)
          if (item.item_type === 'RENTAL') rental += item.amount
          else transport += item.amount
        }
      }
      if (allItems.length === 0) continue

      const billingDate = new Date(mo.year, mo.month - 1, Math.min(30, mo.end.getDate()))

      // v3 FIX: New plans use correct per-month status
      const thisMonthHasActual = allItems.some(i => !i.is_estimated_item)
      const status = (hasAnyActualDelivery && thisMonthHasActual) ? 'PLANNED' : 'DRAFT'

      const planIsEstimated = allItems.every(i => i.is_estimated_item === true)

      const isExtension = diList.some(di => {
        if (!di.delivery_completed_at) return false
        const ce = calcContractEnd(di.delivery_completed_at, di.duration, di.period)
        return ce && mo.start > ce
      })

      const { data: plan } = await supabase.from('invoice_plans').insert({
        proposal_id: proposal.id,
        company_id: proposal.company_id,
        billing_date: toDateStr(billingDate),
        period_start: toDateStr(mo.start),
        period_end: toDateStr(mo.end),
        period_label: mo.label,
        rental_subtotal: Math.round(rental * 100) / 100,
        transport_subtotal: Math.round(transport * 100) / 100,
        extra_subtotal: 0,
        total_amount: Math.round((rental + transport) * 100) / 100,
        currency: proposal.currency || 'TRY',
        status,
        is_estimated: planIsEstimated,
        is_extension: isExtension,
        created_by: userId
      }).select().single()

      if (plan) {
        await supabase.from('invoice_plan_items').insert(
          allItems.map(i => ({ ...i, invoice_plan_id: plan.id }))
        )
        created++
      }
    }

    return { updated, created, cancelled, skippedFrozen }
  }
}

export default invoicePlanService
