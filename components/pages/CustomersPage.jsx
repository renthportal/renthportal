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

const CustomersPage = ({ showToast, setActivePage }) => {
  const [companies, setCompanies] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [formData, setFormData] = useState({})
  const [search, setSearch] = useState('')
  const [companyPage, setCompanyPage] = useState(1)
  const [userPage, setUserPage] = useState(1)

  const loadData = async () => {
    setLoading(true)
    const { data: companiesData } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
    const { data: usersData } = await supabase.from('users').select('*, company:companies(name)').eq('role', 'CUSTOMER')
    setCompanies(companiesData || [])
    setUsers(usersData || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { setCompanyPage(1); setUserPage(1) }, [search])

  const filteredCompanies = companies.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))
  const filteredUsers = users.filter(u => u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.company?.name?.toLowerCase().includes(search.toLowerCase()))

  const handleSaveCompany = async () => {
    try {
      if (formData.id) { await supabase.from('companies').update(formData).eq('id', formData.id); showToast('Firma güncellendi', 'success') }
      else { await supabase.from('companies').insert([formData]); showToast('Firma eklendi', 'success') }
      setShowModal(false); setFormData({}); loadData()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
  }

  const handleSaveUser = async () => {
    try {
      if (!formData.company_id) { showToast('Lütfen firma seçin', 'error'); return }
      const userData = { full_name: formData.full_name, email: formData.email?.toLowerCase(), phone: formData.phone, company_id: formData.company_id, password_hash: formData.password || 'demo123', role: 'CUSTOMER' }
      if (formData.id) {
        const { password_hash, ...updateData } = userData
        const { error } = await supabase.from('users').update(updateData).eq('id', formData.id)
        if (error) throw error
        showToast('Kullanıcı güncellendi', 'success')
      } else {
        const { error } = await supabase.from('users').insert([userData])
        if (error) throw error
        showToast(`Kullanıcı eklendi. Şifre: ${userData.password_hash}`, 'success')
      }
      setShowUserModal(false); setFormData({}); loadData()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
  }

  if (loading) return <div className="p-6 space-y-6"><SkeletonStats count={3} /><SkeletonTable /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-4">
        <div className="flex gap-3">
          <Button variant="outline" size="sm" icon={Users} onClick={() => { setFormData({}); setShowUserModal(true) }}>Yeni Kullanıcı</Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={() => { setFormData({}); setShowModal(true) }}>Yeni Firma</Button>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Firma, müşteri ara..." className="max-w-md" />

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Firmalar ({filteredCompanies.length})</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Firma Adı</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Telefon</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">E-posta</th>
              <th className="text-right px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">İşlem</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {paginate(filteredCompanies, companyPage).map(company => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-4 lg:px-6 py-3 text-sm font-mono text-gray-400">{company.id?.slice(0, 6) || '-'}</td>
                  <td className="px-4 lg:px-6 py-3 font-medium text-gray-900 text-sm">{company.name}</td>
                  <td className="px-4 lg:px-6 py-3 text-sm text-gray-600 hidden sm:table-cell">{company.phone || '-'}</td>
                  <td className="px-4 lg:px-6 py-3 text-sm text-gray-600 hidden md:table-cell">{company.email || '-'}</td>
                  <td className="px-4 lg:px-6 py-3 text-right"><button onClick={() => { setFormData(company); setShowModal(true) }} className="p-2 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4 text-gray-500" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={filteredCompanies.length} page={companyPage} setPage={setCompanyPage} />
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Kullanıcılar ({filteredUsers.length})</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ad Soyad</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">E-posta</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Firma</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Şifre</th>
              <th className="text-right px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">İşlem</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {paginate(filteredUsers, userPage).map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 lg:px-6 py-3 font-medium text-gray-900 text-sm">{user.full_name}</td>
                  <td className="px-4 lg:px-6 py-3 text-sm text-gray-600 hidden sm:table-cell">{user.email}</td>
                  <td className="px-4 lg:px-6 py-3 text-sm text-gray-600">{user.company?.name || '-'}</td>
                  <td className="px-4 lg:px-6 py-3 font-mono text-sm text-gray-600 hidden md:table-cell">{user.password_hash}</td>
                  <td className="px-4 lg:px-6 py-3 text-right"><button onClick={() => { setFormData(user); setShowUserModal(true) }} className="p-2 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4 text-gray-500" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={filteredUsers.length} page={userPage} setPage={setUserPage} />
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={formData.id ? 'Firma Düzenle' : 'Yeni Firma'}>
        <div className="p-6 space-y-4">
          <Input label="Firma Adı *" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Vergi No" value={formData.tax_number || ''} onChange={e => setFormData({...formData, tax_number: e.target.value})} />
            <Input label="Vergi Dairesi" value={formData.tax_office || ''} onChange={e => setFormData({...formData, tax_office: e.target.value})} />
          </div>
          <Input label="Yetkili Adı" value={formData.authorized_name || ''} onChange={e => setFormData({...formData, authorized_name: e.target.value})} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Telefon" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
            <Input label="E-posta" type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <Textarea label="Adres" rows={3} value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowModal(false)}>İptal</Button>
          <Button variant="primary" icon={Save} onClick={handleSaveCompany}>Kaydet</Button>
        </div>
      </Modal>

      <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title={formData.id ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}>
        <div className="p-6 space-y-4">
          <Input label="Ad Soyad *" value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} required />
          <Input label="E-posta *" type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} required />
          <Input label="Telefon" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
          <Input label="Şifre *" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Müşteriye vereceğiniz şifre" />
          <Select label="Firma *" value={formData.company_id || ''} onChange={e => setFormData({...formData, company_id: e.target.value})} options={[{ value: '', label: 'Firma Seçin' }, ...companies.map(c => ({ value: c.id, label: c.name }))]} />
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowUserModal(false)}>İptal</Button>
          <Button variant="primary" icon={Save} onClick={handleSaveUser}>Kaydet</Button>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES PAGE
// ═══════════════════════════════════════════════════════════════════════════



export default CustomersPage
