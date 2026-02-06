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
import { openPdfContent } from '@/lib/helpers'
import { RENTH_LOGO_B64 as LOGO_B64 } from '@/lib/pdf'
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

const FormViewer = ({ item, type, onClose }) => {
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

  // Resolve image for PDF: if already base64 return directly, if URL try to convert
  const resolveForPdf = async (url) => {
    if (!url) return ''
    // Already base64 data URI — use directly (new format)
    if (url.startsWith('data:')) return url
    // Legacy: URL from Supabase Storage — try to convert to base64
    const fixedUrl = fixStorageUrl(url)
    try {
      const match = fixedUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^\/]+)\/(.+)$/)
      if (match) {
        const [, bucket, filePath] = match
        const { data, error } = await supabase.storage.from(bucket).download(filePath)
        if (!error && data) {
          return await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = () => resolve('')
            reader.readAsDataURL(data)
          })
        }
      }
      const resp = await fetch(fixedUrl, { mode: 'cors' })
      if (resp.ok) {
        const blob = await resp.blob()
        return await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = () => resolve('')
          reader.readAsDataURL(blob)
        })
      }
      return ''
    } catch (e) { console.error('resolveForPdf error:', url, e); return '' }
  }

  const handlePrint = async () => {
    setPrinting(true)
    try {
      // Resolve all images to base64 for embedding in PDF
      const [sigB64, ...photoB64s] = await Promise.all([
        resolveForPdf(d.signatureUrl),
        ...d.photos.map(u => resolveForPdf(u))
      ])
      const logoB64 = LOGO_B64
      
      const validPhotos = photoB64s.filter(Boolean)
      const photoGrid = validPhotos.length > 0 
        ? `<div class="section"><div class="section-title">FOTOĞRAFLAR</div><div class="photos">${validPhotos.map(b => `<img src="${b}"/>`).join('')}</div></div>` 
        : ''
      const condBadges = d.conditions.length > 0 ? d.conditions.map(c => `<span class="badge ${c === 'HASAR YOK' ? 'badge-ok' : 'badge-warn'}">${c}</span>`).join(' ') : '<span class="badge badge-ok">Belirtilmedi</span>'
      const logoHtml = `<img src="${logoB64}" style="height:50px"/>`
      const sigHtml = sigB64 ? `<img src="${sigB64}"/>` : '<p style="padding:20px;color:#ccc">İmza yok</p>'
      
      const proposalNum = item.proposal?.proposal_number || item.proposalNumber || '-'
      const companyName = item.proposal?.company?.name || item.customerName || '-'
      
      const html = `<!DOCTYPE html><html><head><title>${isDelivery ? 'Teslimat' : 'İade'} Formu</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;padding:30px;color:#333;font-size:13px}
.header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #C41E3A;padding-bottom:15px;margin-bottom:20px}
.header-left{display:flex;align-items:center;gap:12px}
.header-title{text-align:right}
.header-title h1{font-size:20px;color:#0A1628;text-transform:uppercase;letter-spacing:1px;margin:0}
.header-title p{font-size:11px;color:#6b7280;margin-top:2px}
.section{margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.section-title{font-weight:700;font-size:11px;color:#fff;background:#1a2744;padding:8px 14px;text-transform:uppercase;letter-spacing:0.5px}
.row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f3f4f6}.row:last-child{border:0}
.label{color:#6b7280;font-size:12px}.value{font-weight:600;text-align:right;font-size:12px}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin:2px 4px 2px 0}
.badge-ok{background:#d1fae5;color:#065f46}.badge-warn{background:#fef3c7;color:#92400e}
.photos{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:12px}.photos img{width:100%;height:200px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb}
.sig-section{padding:16px;display:flex;align-items:flex-start;gap:20px}
.sig-box{border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#fafafa;flex:1;text-align:center}
.sig-box img{max-height:70px;margin-bottom:6px}
.sig-box p{font-size:11px;color:#6b7280}.sig-box .name{font-weight:700;color:#1a2744;font-size:13px}
.footer{margin-top:24px;text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
.conditions-wrap{padding:10px 14px}
.note-text{padding:10px 14px;font-size:12px;color:#374151;line-height:1.5}
@media print{.no-print{display:none!important}body{padding:15px}.section{break-inside:avoid}}</style></head><body>
<div class="header">
<div class="header-left">${logoHtml}</div>
<div class="header-title"><h1>${isDelivery ? 'TESLİMAT' : 'İADE'} FORMU</h1><p>${d.completedAt ? new Date(d.completedAt).toLocaleString('tr-TR') : ''}</p></div>
</div>
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
<div class="conditions-wrap">${condBadges}</div>
${d.conditionNotes ? `<div class="note-text" style="border-top:1px solid #f3f4f6"><strong>Detay:</strong> ${d.conditionNotes}</div>` : ''}</div>
${d.notes ? `<div class="section"><div class="section-title">NOTLAR</div><div class="note-text">${d.notes}</div></div>` : ''}
${photoGrid}
<div class="section"><div class="section-title">İMZA</div>
<div class="sig-section">
<div class="sig-box">${sigHtml}
<p class="name">${d.personName || '-'}</p><p>${isDelivery ? 'Teslim Alan' : 'İade Eden'}</p></div>
</div></div>
<div class="footer"><p>Bu form RENTH Portal üzerinden otomatik oluşturulmuştur.</p><p>${new Date().toLocaleString('tr-TR')}</p></div>
</body></html>`
      openPdfContent(html)
    } catch (err) { console.error('PDF generation error:', err) }
    setPrinting(false)
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleString('tr-TR') : '—'

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Info */}
      <div className={`rounded-xl p-4 ${isDelivery ? 'bg-blue-50 border border-blue-100' : 'bg-orange-50 border border-orange-100'}`}>
        <p className="text-xs font-medium text-gray-500 uppercase mb-1">{isDelivery ? '📦 Teslimat Formu' : '🔄 İade Formu'}</p>
        <h4 className="font-bold text-gray-900">{item.machine_type}</h4>
        <p className="text-sm text-gray-600">{item.assigned_machine_serial} — {item.assigned_machine_name}</p>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-500">Tarih</span><span className="text-sm font-medium">{fmtDate(d.completedAt)}</span></div>
        <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-500">Firma</span><span className="text-sm font-medium">{item.proposal?.company?.name}</span></div>
        <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-500">{isDelivery ? 'Teslim Alan' : 'İade Eden'}</span><span className="text-sm font-medium">{d.personName || '—'}</span></div>
        <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-500">Sayaç</span><span className="text-sm font-medium">{d.hourMeter ? `${d.hourMeter} saat` : '—'}</span></div>
        <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-500">Yakıt</span><span className="text-sm font-medium">%{d.fuelLevel ?? '—'}</span></div>
        {d.lat && <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-500">Konum</span><span className="text-sm font-medium">{Number(d.lat).toFixed(6)}, {Number(d.lng).toFixed(6)}</span></div>}
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
          {d.conditionNotes && <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-3">{d.conditionNotes}</p>}
        </div>
      )}

      {/* Notes */}
      {d.notes && <div className="py-2 border-b border-gray-100"><span className="text-sm text-gray-500 block mb-1">Notlar</span><span className="text-sm">{d.notes}</span></div>}

      {/* Photos */}
      {d.photos.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Fotoğraflar ({d.photos.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {d.photos.map((url, i) => <a key={i} href={resolveImageSrc(url)} target="_blank" rel="noopener" className="aspect-square rounded-lg overflow-hidden border border-gray-200"><img src={resolveImageSrc(url)} alt="" className="w-full h-full object-cover" /></a>)}
          </div>
        </div>
      )}

      {/* Signature */}
      {d.signatureUrl && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Müşteri İmzası</p>
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 inline-block">
            <img src={resolveImageSrc(d.signatureUrl)} alt="İmza" className="h-16" />
            <p className="text-xs text-gray-500 mt-1">{d.personName}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} className="flex-1">Kapat</Button>
        <Button variant="primary" icon={Download} onClick={handlePrint} loading={printing} className="flex-1">{printing ? 'Hazırlanıyor...' : 'Yazdır / PDF'}</Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// RENTALS PAGE — Kiralamalar (Teslimat + İade Takibi)
// ═══════════════════════════════════════════════════════════════════════════



export default FormViewer
