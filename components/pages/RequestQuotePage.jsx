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

const RequestQuotePage = ({ user, showToast, preselectedMachine }) => {
  const [machineTypes, setMachineTypes] = useState([])
  const [cities, setCities] = useState([])
  const [districts, setDistricts] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [items, setItems] = useState([{ machine_type: preselectedMachine?.name || '', rental_period: 'MONTHLY', duration: 1, estimated_start: '', estimated_end: '', item_notes: '' }])
  const [form, setForm] = useState({ city: '', district: '', address_detail: '', notes: '' })

  useEffect(() => {
    const load = async () => {
      const [machinesRes, citiesRes] = await Promise.all([supabase.from('machines').select('name, is_hidden').order('name'), supabase.from('cities').select('*').order('name')])
      setMachineTypes([...new Set((machinesRes.data || []).filter(m => !m.is_hidden).map(m => m.name))]); setCities(citiesRes.data || []); setLoading(false)
    }
    load()
  }, [])

  useEffect(() => { if (preselectedMachine) setItems([{ machine_type: preselectedMachine.name, rental_period: 'MONTHLY', duration: 1, estimated_start: '', estimated_end: '', item_notes: '' }]) }, [preselectedMachine])

  useEffect(() => {
    const load = async () => {
      if (!form.city) { setDistricts([]); return }
      const city = cities.find(c => c.name === form.city)
      if (city) { const { data } = await supabase.from('districts').select('*').eq('city_id', city.id).order('name'); setDistricts(data || []) }
    }
    load()
  }, [form.city, cities])

  const getPeriodLabel = (p) => ({ DAILY: 'Gün', WEEKLY: 'Hafta', MONTHLY: 'Ay' }[p] || '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (items.some(i => !i.machine_type || !i.duration)) { showToast('Tüm makine bilgilerini doldurun', 'error'); return }
    if (!form.city) { showToast('İl seçin', 'error'); return }
    setSubmitting(true)
    try {
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const { data: todayProposals } = await supabase.from('proposals').select('proposal_number').like('proposal_number', `RT-${dateStr}-%`).order('proposal_number', { ascending: false }).limit(1)
      let seqNum = 1
      if (todayProposals?.length > 0) seqNum = parseInt(todayProposals[0].proposal_number.split('-').pop(), 10) + 1
      const proposalNumber = `RT-${dateStr}-${String(seqNum).padStart(3, '0')}`
      const { data: companyData } = await supabase.from('companies').select('*').eq('id', user.company_id).single()
      const itemsText = items.map((item, i) => {
        let line = `${i + 1}. ${item.machine_type} - ${item.duration} ${getPeriodLabel(item.rental_period)}`
        if (item.estimated_start) line += ` | Başlangıç: ${item.estimated_start}`
        if (item.estimated_end) line += ` | Bitiş: ${item.estimated_end}`
        if (item.item_notes) line += `\n   Not: ${item.item_notes}`
        return line
      }).join('\n')

      const { error } = await supabase.from('proposals').insert([{
        proposal_number: proposalNumber, company_id: user.company_id, user_id: user.id, status: 'PENDING',
        notes: `[TEKLİF TALEBİ]\n\nMakineler:\n${itemsText}\n\nTeslimat Adresi:\n${form.city}${form.district ? ' / ' + form.district : ''}\n${form.address_detail || ''}\n\nGenel Notlar:\n${form.notes || '-'}`,
        quote_items: JSON.stringify(items.map(item => ({ machine_type: item.machine_type, duration: item.duration, period: getPeriodLabel(item.rental_period), estimated_start: item.estimated_start, estimated_end: item.estimated_end, item_notes: item.item_notes || '', rental_price: 0, rental_discount: 0, transport_price: 0, transport_discount: 0 }))),
        valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
      }]).select().single()
      if (error) throw error

      showToast('Teklif talebiniz alındı!', 'success')
      setItems([{ machine_type: '', rental_period: 'MONTHLY', duration: 1, estimated_start: '', estimated_end: '', item_notes: '' }])
      setForm({ city: '', district: '', address_detail: '', notes: '' })
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
    setSubmitting(false)
  }

  if (loading) return <div className="p-6"><SkeletonPulse className="w-full h-96 rounded-2xl" /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <Card className="p-4 lg:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between"><label className="block text-sm font-semibold text-gray-900">Makineler</label><Button type="button" variant="outline" size="sm" icon={Plus} onClick={() => setItems([...items, { machine_type: '', rental_period: 'MONTHLY', duration: 1, estimated_start: '', estimated_end: '', item_notes: '' }])}>Makine Ekle</Button></div>
            {items.map((item, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-3 lg:p-4 space-y-3">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">Makine {index + 1}</span>{items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} className="text-red-500"><Trash2 className="w-4 h-4" /></button>}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><SearchableSelect label="Makine Türü *" value={item.machine_type} onChange={val => { const n = [...items]; n[index].machine_type = val; setItems(n) }} options={machineTypes} placeholder="Makine türü seçin..." searchPlaceholder="Makine ara..." /></div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">Periyod *</label><select value={item.rental_period} onChange={e => { const n = [...items]; n[index].rental_period = e.target.value; setItems(n) }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A]"><option value="DAILY">Günlük</option><option value="WEEKLY">Haftalık</option><option value="MONTHLY">Aylık</option></select></div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">Süre ({getPeriodLabel(item.rental_period)}) *</label><input type="number" min="1" value={item.duration} onChange={e => { const n = [...items]; n[index].duration = parseInt(e.target.value) || 1; setItems(n) }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A]" required /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">Tahmini Başlangıç Tarihi</label><input type="date" value={item.estimated_start || ''} onChange={e => { const n = [...items]; n[index].estimated_start = e.target.value; setItems(n) }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A]" /></div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">Tahmini Bitiş Tarihi</label><input type="date" value={item.estimated_end || ''} onChange={e => { const n = [...items]; n[index].estimated_end = e.target.value; setItems(n) }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A]" /></div>
                </div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Not</label><textarea rows={2} value={item.item_notes || ''} onChange={e => { const n = [...items]; n[index].item_notes = e.target.value; setItems(n) }} placeholder="Bu makine için özel talepleriniz..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A]" /></div>
              </div>
            ))}
          </div>
          <hr className="border-gray-200" />
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-900">Teslimat Adresi</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-500 mb-1">İl *</label><select value={form.city} onChange={e => setForm({ ...form, city: e.target.value, district: '' })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A]" required><option value="">İl seçin...</option>{cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">İlçe</label><select value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A]" disabled={!form.city}><option value="">İlçe seçin...</option>{districts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
            </div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Adres Detayı</label><textarea value={form.address_detail} onChange={e => setForm({ ...form, address_detail: e.target.value })} rows={2} placeholder="Şantiye adı, mahalle, sokak vb." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A]" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Genel Notlar</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Ek talepleriniz..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A]" /></div>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={submitting} icon={Send}>Teklif Talebi Gönder</Button>
        </form>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD PAGE (with notifications, quick actions, recent proposals)
// ═══════════════════════════════════════════════════════════════════════════



export default RequestQuotePage
