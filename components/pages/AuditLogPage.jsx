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

const AuditLogPage = ({ showToast }) => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  useEffect(() => { loadLogs() }, [])

  const loadLogs = async () => {
    setLoading(true)
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500)
    setLogs(data || [])
    setLoading(false)
  }

  const ACTION_LABELS = {
    LOGIN: { label: 'Giriş', color: 'bg-blue-100 text-blue-700' },
    LOGOUT: { label: 'Çıkış', color: 'bg-gray-100 text-gray-700' },
    LOGIN_FAILED: { label: 'Başarısız Giriş', color: 'bg-red-100 text-red-700' },
    PASSWORD_CHANGE: { label: 'Şifre Değişikliği', color: 'bg-purple-100 text-purple-700' },
    PROFILE_UPDATE: { label: 'Profil Güncelleme', color: 'bg-blue-100 text-blue-700' },
    KVKK_CONSENT: { label: 'KVKK Onayı', color: 'bg-emerald-100 text-emerald-700' },
    PROPOSAL_CREATE: { label: 'Teklif Talebi', color: 'bg-amber-100 text-amber-700' },
    PROPOSAL_APPROVE: { label: 'Teklif Onayı', color: 'bg-emerald-100 text-emerald-700' },
    PROPOSAL_REJECT: { label: 'Teklif Reddi', color: 'bg-red-100 text-red-700' },
    CONTRACT_SIGN: { label: 'Sözleşme İmza', color: 'bg-emerald-100 text-emerald-700' },
    SERVICE_CREATE: { label: 'Servis Talebi', color: 'bg-amber-100 text-amber-700' },
    USER_APPROVE: { label: 'Kullanıcı Onayı', color: 'bg-emerald-100 text-emerald-700' },
  }

  const actions = [...new Set(logs.map(l => l.action))]

  const filtered = useMemo(() => {
    let result = logs
    if (search) result = result.filter(l => (l.user_name || '').toLowerCase().includes(search.toLowerCase()) || (l.action || '').toLowerCase().includes(search.toLowerCase()))
    if (filterAction) result = result.filter(l => l.action === filterAction)
    return result
  }, [logs, search, filterAction])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  if (loading) return <div className="p-6"><SkeletonTable rows={10} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <Card className="p-3 lg:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Kullanıcı, işlem ara..." className="flex-1" />
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
            <option value="">Tüm İşlemler</option>
            {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>)}
          </select>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Tarih</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Kullanıcı</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">İşlem</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Detay</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map(log => {
                const config = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' }
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 lg:px-6 py-3 text-sm text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString('tr-TR')}</td>
                    <td className="px-4 lg:px-6 py-3 text-sm font-medium text-gray-900">{log.user_name || '-'}</td>
                    <td className="px-4 lg:px-6 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${config.color}`}>{config.label}</span></td>
                    <td className="px-4 lg:px-6 py-3 text-xs text-gray-400 hidden md:table-cell max-w-xs truncate">{log.details ? JSON.stringify(log.details).slice(0, 100) : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 lg:px-6 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">Toplam {filtered.length} kayıt, Sayfa {page}/{totalPages}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 text-sm rounded-lg border disabled:opacity-30 hover:bg-gray-50">Önceki</button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm rounded-lg border disabled:opacity-30 hover:bg-gray-50">Sonraki</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR (MOBILE RESPONSIVE) & HEADER
// ═══════════════════════════════════════════════════════════════════════════



export default AuditLogPage
