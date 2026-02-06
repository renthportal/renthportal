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

const VisitsPage = ({ user, showToast, isAdmin, setActivePage }) => {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' })
  const [page, setPage] = useState(1)
  const [customers, setCustomers] = useState([])
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)

  const emptyForm = { company_id: '', contact_name: '', contact_phone: '', contact_email: '', activity_type: '', activity_notes: '', photo_url: '', latitude: null, longitude: null, visit_date: new Date().toISOString() }
  const [form, setForm] = useState(emptyForm)

  const loadData = async () => {
    setLoading(true)
    try {
      let query = supabase.from('visits').select('*, company:companies(id, name), visitor:users(id, full_name)').order('visit_date', { ascending: false })
      if (!isAdmin) query = query.eq('user_id', user.id)
      const { data, error } = await query
      if (error) console.warn('visits query error:', error.message)
      setVisits(data || [])
    } catch (err) { console.error('visits loadData error:', err); setVisits([]) }

    try {
      const { data: compData, error: compError } = await supabase.from('companies').select('id, name, authorized_name, phone, email').order('name')
      if (compError) console.warn('companies query error:', compError.message)
      setCustomers(compData || [])
    } catch (err) { console.error('companies loadData error:', err); setCustomers([]) }

    setLoading(false)
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { setPage(1) }, [search, typeFilter, dateFilter])

  const filteredVisits = visits.filter(v => {
    const matchSearch = !search || v.company?.name?.toLowerCase().includes(search.toLowerCase()) || v.contact_name?.toLowerCase().includes(search.toLowerCase()) || v.activity_notes?.toLowerCase().includes(search.toLowerCase())
    const matchType = !typeFilter || v.activity_type === typeFilter
    const matchFrom = !dateFilter.from || new Date(v.visit_date) >= new Date(dateFilter.from)
    const matchTo = !dateFilter.to || new Date(v.visit_date) <= new Date(dateFilter.to + 'T23:59:59')
    return matchSearch && matchType && matchFrom && matchTo
  })

  const openNewVisit = () => {
    setForm({ ...emptyForm, visit_date: new Date().toISOString() })
    setShowNewModal(true)
    // Auto get location
    getLocation()
  }

  const getLocation = () => {
    if (!navigator.geolocation) { showToast('Konum servisi desteklenmiyor', 'error'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }))
        setLocating(false)
      },
      (err) => {
        console.warn('Konum alınamadı:', err)
        showToast('Konum alınamadı. Lütfen konum izni verin.', 'warning')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleCustomerChange = (companyId) => {
    const cust = customers.find(c => c.id === companyId)
    setForm(prev => ({
      ...prev,
      company_id: companyId,
      contact_name: cust?.authorized_name || '',
      contact_phone: cust?.phone || '',
      contact_email: cust?.email || ''
    }))
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const filePath = `visits/${user.id}/${Date.now()}.${file.name.split('.').pop()}`
      const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file)
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)
      setForm(prev => ({ ...prev, photo_url: urlData?.publicUrl || '' }))
      showToast('Fotoğraf yüklendi', 'success')
    } catch (err) { showToast('Fotoğraf yüklenemedi: ' + err.message, 'error') }
    setPhotoUploading(false)
  }

  const handleSave = async () => {
    if (!form.company_id) { showToast('Müşteri seçin', 'error'); return }
    if (!form.activity_type) { showToast('Aktivite türü seçin', 'error'); return }
    if (!form.activity_notes?.trim()) { showToast('Aktivite notu yazın', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        company_id: form.company_id,
        contact_name: form.contact_name,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        activity_type: form.activity_type,
        activity_notes: form.activity_notes,
        photo_url: form.photo_url || null,
        latitude: form.latitude,
        longitude: form.longitude,
        visit_date: new Date().toISOString()
      }
      const { error } = await supabase.from('visits').insert([payload])
      if (error) throw error
      logAudit(user.id, user.full_name, 'VISIT_CREATED', { company_id: form.company_id, activity_type: form.activity_type })
      showToast('Ziyaret kaydedildi', 'success')
      setShowNewModal(false)
      loadData()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
    setSaving(false)
  }

  const getActivityLabel = (type) => ACTIVITY_TYPES.find(t => t.value === type)?.label || type
  const getActivityColor = (type) => ACTIVITY_TYPE_COLORS[type] || ACTIVITY_TYPE_COLORS.PHONE

  // Stats
  const thisMonth = visits.filter(v => { const d = new Date(v.visit_date); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() })
  const todayVisits = visits.filter(v => new Date(v.visit_date).toDateString() === new Date().toDateString())

  if (loading) return <div className="p-6 space-y-6"><SkeletonStats count={4} /><SkeletonTable /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MapPin} label="Toplam Ziyaret" value={visits.length} variant="navy" />
        <StatCard icon={Calendar} label="Bu Ay" value={thisMonth.length} variant="primary" />
        <StatCard icon={Clock} label="Bugün" value={todayVisits.length} variant="success" />
        <StatCard icon={Building2} label="Ziyaret Edilen Firma" value={[...new Set(visits.map(v => v.company_id))].length} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full lg:w-auto">
          <SearchBar value={search} onChange={setSearch} placeholder="Firma, kişi veya not ara..." className="flex-1" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent">
            <option value="">Tüm Türler</option>
            {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Input type="date" value={dateFilter.from} onChange={e => setDateFilter({...dateFilter, from: e.target.value})} className="w-36" />
          <Input type="date" value={dateFilter.to} onChange={e => setDateFilter({...dateFilter, to: e.target.value})} className="w-36" />
        </div>
        <Button variant="primary" icon={Plus} onClick={openNewVisit}>Yeni Ziyaret</Button>
      </div>

      {/* Visit List */}
      <Card>
        {filteredVisits.length === 0 ? (
          <EmptyState icon={MapPin} title="Ziyaret kaydı yok" description="Yeni bir müşteri ziyareti ekleyin." action={<Button variant="primary" size="sm" icon={Plus} onClick={openNewVisit}>Yeni Ziyaret</Button>} />
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {paginate(filteredVisits, page).map(visit => {
                const color = getActivityColor(visit.activity_type)
                const Icon = ACTIVITY_TYPE_ICONS[visit.activity_type] || MapPin
                return (
                  <div key={visit.id} className="p-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setSelectedVisit(visit); setShowDetailModal(true) }}>
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-xl ${color.bg} flex-shrink-0`}><Icon className={`w-5 h-5 ${color.text}`} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-900 text-sm">{visit.company?.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color.bg} ${color.text}`}>{getActivityLabel(visit.activity_type)}</span>
                        </div>
                        {visit.contact_name && <p className="text-xs text-gray-500 mb-1"><User className="w-3 h-3 inline mr-1" />{visit.contact_name}</p>}
                        <p className="text-sm text-gray-600 line-clamp-2">{visit.activity_notes}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span><Calendar className="w-3 h-3 inline mr-1" />{new Date(visit.visit_date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {visit.latitude && <span><MapPin className="w-3 h-3 inline mr-1" />{Number(visit.latitude).toFixed(4)}, {Number(visit.longitude).toFixed(4)}</span>}
                          {isAdmin && visit.visitor && <span><User className="w-3 h-3 inline mr-1" />{visit.visitor?.full_name}</span>}
                          {visit.photo_url && <span><Camera className="w-3 h-3 inline mr-1" />Fotoğraf</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-2" />
                    </div>
                  </div>
                )
              })}
            </div>
            <Pagination total={filteredVisits.length} page={page} setPage={setPage} />
          </>
        )}
      </Card>

      {/* New Visit Modal */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Yeni Ziyaret Kaydı" size="lg">
        <div className="p-6 space-y-5">
          {/* Auto-captured date & location (non-editable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tarih</label>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200 text-sm text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400" />
                {new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                <Lock className="w-3 h-3 text-gray-400 ml-auto" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Otomatik kaydedilir, değiştirilemez</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Konum</label>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200 text-sm text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400" />
                {locating ? (
                  <span className="flex items-center gap-2"><RefreshCw className="w-3 h-3 animate-spin" />Konum alınıyor...</span>
                ) : form.latitude ? (
                  <span>{Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}</span>
                ) : (
                  <span className="text-gray-400">Konum alınamadı</span>
                )}
                <Lock className="w-3 h-3 text-gray-400 ml-auto" />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Otomatik kaydedilir, değiştirilemez
                {!form.latitude && !locating && <button onClick={getLocation} className="ml-2 text-blue-500 hover:underline">Tekrar dene</button>}
              </p>
            </div>
          </div>

          {form.latitude && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <iframe title="Konum" width="100%" height="180" frameBorder="0" style={{border:0}} src={`https://www.google.com/maps?q=${form.latitude},${form.longitude}&z=16&output=embed`} allowFullScreen />
            </div>
          )}

          <hr className="border-gray-100" />

          {/* Customer Selection */}
          <div>
            {!form.company_id ? (
              <SearchableSelect
                label="Müşteri Adı *"
                value={form.company_id}
                onChange={val => handleCustomerChange(val)}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Müşteri ara ve seç..."
                searchPlaceholder="Firma adı yazın..."
              />
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Müşteri Adı *</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm font-medium text-blue-800">
                    {customers.find(c => c.id === form.company_id)?.name || 'Seçili Müşteri'}
                  </div>
                  <button onClick={() => setForm(prev => ({...prev, company_id: '', contact_name: '', contact_phone: '', contact_email: ''}))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Yetkili Adı *" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} icon={User} />
            <Input label="Müşteri Tel *" value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} icon={Phone} />
            <Input label="Müşteri Mail" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} icon={Mail} />
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Aktivite Türü *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ACTIVITY_TYPES.map(type => {
                const Icon = ACTIVITY_TYPE_ICONS[type.value] || MapPin
                const color = ACTIVITY_TYPE_COLORS[type.value]
                const isSelected = form.activity_type === type.value
                return (
                  <button key={type.value} onClick={() => setForm({...form, activity_type: type.value})}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-[#C41E3A] bg-red-50 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#C41E3A]' : color.bg}`}>
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : color.text}`} />
                    </div>
                    <span className={`text-xs font-medium ${isSelected ? 'text-[#C41E3A]' : 'text-gray-600'}`}>{type.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <Textarea label="Aktivite Notu *" rows={4} value={form.activity_notes} onChange={e => setForm({...form, activity_notes: e.target.value})} placeholder="Ziyaret hakkında detayları yazın..." />

          {/* Photo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fotoğraf</label>
            {form.photo_url ? (
              <div className="relative w-fit">
                <img src={fixStorageUrl(form.photo_url)} alt="Visit photo" className="w-40 h-40 object-cover rounded-xl border border-gray-200" />
                <button onClick={() => setForm({...form, photo_url: ''})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
                {photoUploading ? <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" /> : <Camera className="w-8 h-8 text-gray-400 mb-1" />}
                <span className="text-xs text-gray-500">{photoUploading ? 'Yükleniyor...' : 'Fotoğraf çek veya seç'}</span>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={photoUploading} />
              </label>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowNewModal(false)}>İptal</Button>
            <Button variant="primary" icon={Save} loading={saving} onClick={handleSave}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Ziyaret Detayı" size="md">
        {selectedVisit && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              {(() => { const Icon = ACTIVITY_TYPE_ICONS[selectedVisit.activity_type] || MapPin; const color = getActivityColor(selectedVisit.activity_type); return <div className={`p-3 rounded-xl ${color.bg}`}><Icon className={`w-6 h-6 ${color.text}`} /></div> })()}
              <div>
                <h3 className="font-bold text-lg text-gray-900">{selectedVisit.company?.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getActivityColor(selectedVisit.activity_type).bg} ${getActivityColor(selectedVisit.activity_type).text}`}>{getActivityLabel(selectedVisit.activity_type)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Yetkili Kişi</p><p className="font-medium text-sm">{selectedVisit.contact_name || '-'}</p></div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Telefon</p><p className="font-medium text-sm">{selectedVisit.contact_phone || '-'}</p></div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">E-posta</p><p className="font-medium text-sm">{selectedVisit.contact_email || '-'}</p></div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 mb-1">Tarih</p><p className="font-medium text-sm">{new Date(selectedVisit.visit_date).toLocaleString('tr-TR')}</p></div>
              {isAdmin && selectedVisit.visitor && <div className="bg-gray-50 rounded-xl p-3 col-span-2"><p className="text-xs text-gray-500 mb-1">Kayıt Eden</p><p className="font-medium text-sm">{selectedVisit.visitor?.full_name}</p></div>}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Aktivite Notu</p>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">{selectedVisit.activity_notes}</div>
            </div>

            {selectedVisit.latitude && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Konum</p>
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <iframe title="Konum" width="100%" height="200" frameBorder="0" style={{border:0}} src={`https://www.google.com/maps?q=${selectedVisit.latitude},${selectedVisit.longitude}&z=16&output=embed`} allowFullScreen />
                </div>
                <p className="text-xs text-gray-400 mt-1">{Number(selectedVisit.latitude).toFixed(6)}, {Number(selectedVisit.longitude).toFixed(6)}</p>
              </div>
            )}

            {selectedVisit.photo_url && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Fotoğraf</p>
                <img src={fixStorageUrl(selectedVisit.photo_url)} alt="Ziyaret fotoğrafı" className="w-full max-h-64 object-cover rounded-xl border border-gray-200" />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}



export default VisitsPage
