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

const DeliveryReturnForm = ({ item, type, user, onComplete, onClose, showToast }) => {
  const [form, setForm] = useState({ hour_meter: '', fuel_level: 50, person_name: '', notes: '', conditions: [], condition_notes: '' })
  const [photos, setPhotos] = useState([])
  const [photoFiles, setPhotoFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [gps, setGps] = useState({ lat: null, lng: null, loading: true, error: null })
  const [showConditionDropdown, setShowConditionDropdown] = useState(false)
  const condDropdownRef = useRef(null)
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  const isDelivery = type === 'delivery'
  const prefix = isDelivery ? 'delivery' : 'return'

  // GPS capture
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, loading: false, error: null }),
        (err) => setGps({ lat: null, lng: null, loading: false, error: 'Konum alınamadı' }),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    } else { setGps({ lat: null, lng: null, loading: false, error: 'GPS desteklenmiyor' }) }
  }, [])

  // Close condition dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => { if (condDropdownRef.current && !condDropdownRef.current.contains(e.target)) setShowConditionDropdown(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }
  const startDraw = (e) => { e.preventDefault(); const c = canvasRef.current; const ctx = c.getContext('2d'); const p = getPos(e, c); ctx.beginPath(); ctx.moveTo(p.x, p.y); setIsDrawing(true) }
  const moveDraw = (e) => { if (!isDrawing) return; e.preventDefault(); const c = canvasRef.current; const ctx = c.getContext('2d'); const p = getPos(e, c); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSignature(true) }
  const stopDraw = () => setIsDrawing(false)
  const clearSig = () => { const c = canvasRef.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setHasSignature(false) }

  const toggleCondition = (cond) => {
    setForm(prev => {
      const has = prev.conditions.includes(cond)
      let next = has ? prev.conditions.filter(c => c !== cond) : [...prev.conditions, cond]
      // If "HASAR YOK" selected, remove all others. If other selected, remove "HASAR YOK"
      if (cond === 'HASAR YOK' && !has) next = ['HASAR YOK']
      else if (cond !== 'HASAR YOK' && !has) next = next.filter(c => c !== 'HASAR YOK')
      return { ...prev, conditions: next }
    })
  }

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setPhotos(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    setPhotoFiles(prev => [...prev, ...files])
  }
  const removePhoto = (i) => { setPhotos(prev => prev.filter((_, idx) => idx !== i)); setPhotoFiles(prev => prev.filter((_, idx) => idx !== i)) }

  const handleSubmit = async () => {
    if (!form.hour_meter) { showToast('Sayaç değeri zorunlu', 'error'); return }
    if (!form.person_name.trim()) { showToast(isDelivery ? 'Teslim alan kişi adı zorunlu' : 'İade eden kişi adı zorunlu', 'error'); return }
    if (form.conditions.length === 0) { showToast('Makine genel durumu seçiniz', 'error'); return }
    setSaving(true)
    try {
      // Upload photos to Supabase Storage
      const photoUrls = []
      for (let i = 0; i < photoFiles.length; i++) {
        const file = photoFiles[i]
        // Try compress, fallback to raw file
        const blob = await compressImageToBlob(file, 1200, 0.7) || file
        const ext = blob.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop()
        const fileName = `${prefix}/${item.id}/${Date.now()}_${i}.${ext}`
        const { error: upErr } = await supabase.storage.from('rentals').upload(fileName, blob, { contentType: blob.type || 'image/jpeg', upsert: true })
        if (upErr) {
          console.error('Photo upload error:', upErr)
          showToast(`Fotoğraf ${i + 1} yüklenemedi: ${upErr.message}`, 'error')
          setSaving(false)
          return
        }
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
          if (sigErr) {
            console.error('Signature upload error:', sigErr)
            showToast('İmza yüklenemedi: ' + sigErr.message, 'error')
            setSaving(false)
            return
          }
          const { data: su } = supabase.storage.from('rentals').getPublicUrl(sigName)
          signatureUrl = su.publicUrl
        }
      }
      // Update DB record
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
      // Auto fleet status
      if (item.assigned_machine_id) await supabase.from('fleet').update({ status: isDelivery ? 'RENTED' : 'AVAILABLE' }).eq('id', item.assigned_machine_id)
      showToast(isDelivery ? 'Teslimat tamamlandı!' : 'İade tamamlandı!', 'success')
      onComplete()
    } catch (err) {
      console.error('Form submit error:', err)
      showToast('Hata: ' + err.message, 'error')
    }
    setSaving(false)
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className={`rounded-xl p-4 ${isDelivery ? 'bg-blue-50 border border-blue-100' : 'bg-orange-50 border border-orange-100'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDelivery ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
            {isDelivery ? '📦 Teslimat Formu' : '🔄 İade Formu'}
          </span>
        </div>
        <h4 className="font-semibold text-gray-900">{item.machine_type}</h4>
        {item.assigned_machine_name && <p className="text-sm text-gray-600">{item.assigned_machine_serial} — {item.assigned_machine_name}</p>}
        {item.proposal?.company?.name && <p className="text-xs text-gray-400 mt-0.5">{item.proposal.company.name}</p>}
      </div>

      {/* Sayaç & Yakıt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Sayaç Değeri (Saat) *" type="number" step="0.1" value={form.hour_meter} onChange={e => setForm({...form, hour_meter: e.target.value})} placeholder="Örn: 1250.5" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Yakıt Seviyesi: <span className="font-bold text-amber-600">%{form.fuel_level}</span></label>
          <input type="range" min="0" max="100" step="5" value={form.fuel_level} onChange={e => setForm({...form, fuel_level: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500" />
          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Boş</span><span>¼</span><span>½</span><span>¾</span><span>Dolu</span></div>
        </div>
      </div>

      {/* Kişi */}
      <Input label={isDelivery ? 'Teslim Alan Kişi Adı *' : 'İade Eden Kişi Adı *'} value={form.person_name} onChange={e => setForm({...form, person_name: e.target.value})} placeholder="Ad Soyad" />

      {/* Makine Genel Durumu */}
      <div ref={condDropdownRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Makine Genel Durumu *</label>
        <div className="relative">
          <button type="button" onClick={() => setShowConditionDropdown(!showConditionDropdown)}
            className={`w-full rounded-lg border bg-white px-4 py-2.5 text-left text-sm flex items-center justify-between transition-all ${form.conditions.length > 0 ? 'border-gray-200' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#F7B500]`}>
            <span className={form.conditions.length > 0 ? 'text-gray-900' : 'text-gray-400'}>
              {form.conditions.length > 0 ? `${form.conditions.length} durum seçildi` : 'Durum seçiniz...'}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showConditionDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showConditionDropdown && (
            <div className="absolute z-20 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
              {MACHINE_CONDITIONS.map(cond => {
                const selected = form.conditions.includes(cond)
                const isNoHasar = cond === 'HASAR YOK'
                return (
                  <button key={cond} type="button" onClick={() => toggleCondition(cond)}
                    className={`w-full px-4 py-2.5 text-sm text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${selected ? (isNoHasar ? 'bg-emerald-50' : 'bg-amber-50') : ''}`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${selected ? (isNoHasar ? 'bg-emerald-500 border-emerald-500' : 'bg-amber-500 border-amber-500') : 'border-gray-300'}`}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`${selected ? 'font-medium' : ''} ${isNoHasar && selected ? 'text-emerald-700' : ''}`}>{cond}</span>
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
                {c}
                <button type="button" onClick={() => toggleCondition(c)} className="hover:opacity-70">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Detay Açıklama */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Detay Açıklama {form.conditions.some(c => c !== 'HASAR YOK') && <span className="text-red-500">*</span>}</label>
        <textarea rows={2} value={form.condition_notes} onChange={e => setForm({...form, condition_notes: e.target.value})} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-300 focus:border-transparent outline-none" placeholder="Hasar veya durum detaylarını yazınız..." />
      </div>

      {/* Fotoğraflar */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Fotoğraflar {photos.length > 0 && <span className="text-gray-400">({photos.length})</span>}</label>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-2">
          {photos.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => removePhoto(i)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs leading-none">×</button>
            </div>
          ))}
          <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-amber-400 transition-colors">
            <Camera className="w-5 h-5 text-gray-400 mb-0.5" />
            <span className="text-[10px] text-gray-400">Ekle</span>
            <input type="file" accept="image/*" multiple capture="environment" onChange={handlePhotoAdd} className="hidden" />
          </label>
        </div>
        <p className="text-xs text-gray-400">Makine genel, sayaç, hasar (varsa), teslim noktası</p>
      </div>

      {/* İmza Canvas */}
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

      {/* GPS */}
      <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {gps.loading ? <p className="text-xs text-gray-400">Konum alınıyor...</p>
          : gps.error ? <p className="text-xs text-amber-500">⚠️ {gps.error}</p>
          : <p className="text-xs text-gray-600">{gps.lat?.toFixed(6)}, {gps.lng?.toFixed(6)}</p>}
      </div>

      {/* Notlar */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Notlar</label>
        <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-300 focus:border-transparent outline-none" placeholder={isDelivery ? 'Teslimat ile ilgili notlar...' : 'İade ile ilgili notlar, hasar durumu...'} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} className="flex-1">İptal</Button>
        <Button variant={isDelivery ? 'primary' : 'success'} onClick={handleSubmit} loading={saving} className="flex-1">
          {isDelivery ? '✅ Teslimatı Tamamla' : '✅ İadeyi Tamamla'}
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// FORM VIEWER — Teslim / İade Formu
// ═══════════════════════════════════════════════════════════════════════════



export default DeliveryReturnForm
