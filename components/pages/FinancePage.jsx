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

const FinancePage = ({ user, showToast, isAdmin }) => {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const loadData = async () => {
    setLoading(true)
    let query = supabase.from('invoices').select(`*, company:companies(name), contract:contracts(contract_number)`).order('created_at', { ascending: false })
    if (!isAdmin && user?.company_id) query = query.eq('company_id', user.company_id)
    const { data } = await query
    setInvoices(data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { setPage(1) }, [search])

  const filteredInvoices = invoices.filter(i => i.invoice_number?.toLowerCase().includes(search.toLowerCase()) || i.company?.name?.toLowerCase().includes(search.toLowerCase()))
  const totalReceivable = invoices.filter(i => i.status !== 'PAID').reduce((s, i) => s + (i.total_amount - (i.paid_amount || 0)), 0)
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total_amount, 0)

  if (loading) return <div className="p-6 space-y-6"><SkeletonStats count={3} /><SkeletonTable /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <SearchBar value={search} onChange={setSearch} placeholder="Fatura no, firma ara..." className="max-w-md" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
        <StatCard icon={Wallet} label="Toplam Alacak" value={`₺${totalReceivable.toLocaleString()}`} variant="primary" />
        <StatCard icon={CheckCircle2} label="Tahsil Edilen" value={`₺${totalPaid.toLocaleString()}`} variant="success" />
        <StatCard icon={FileText} label="Fatura Sayısı" value={invoices.length} variant="navy" />
      </div>
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Faturalar</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Fatura No</th>
              {isAdmin && <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Firma</th>}
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Tutar</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Vade</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Durum</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {paginate(filteredInvoices, page).map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 lg:px-6 py-3 font-mono text-xs font-semibold">{inv.invoice_number}</td>
                  {isAdmin && <td className="px-4 lg:px-6 py-3 text-gray-600 text-sm hidden sm:table-cell">{inv.company?.name}</td>}
                  <td className="px-4 lg:px-6 py-3 font-semibold text-gray-900 text-sm">₺{inv.total_amount?.toLocaleString()}</td>
                  <td className="px-4 lg:px-6 py-3 text-gray-500 text-sm hidden md:table-cell">{inv.due_date}</td>
                  <td className="px-4 lg:px-6 py-3"><StatusBadge status={inv.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={filteredInvoices.length} page={page} setPage={setPage} />
        {filteredInvoices.length === 0 && <EmptyState icon={Wallet} title="Fatura yok" description="Henüz fatura bulunmuyor." />}
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MACHINE CATALOG (with favorites & recently viewed)
// ═══════════════════════════════════════════════════════════════════════════



export default FinancePage
