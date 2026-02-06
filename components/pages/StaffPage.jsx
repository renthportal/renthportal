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

const StaffPage = ({ showToast }) => {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [formData, setFormData] = useState({ full_name: '', email: '', phone: '', role: 'SALES', password_hash: '' })

  const loadStaff = async () => {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').in('role', ['ADMIN', 'SUPER_ADMIN', 'STAFF', 'SALES', 'OPERATIONS', 'DRIVER']).order('full_name')
    setStaff(data || [])
    setLoading(false)
  }

  useEffect(() => { loadStaff() }, [])

  const handleSave = async () => {
    if (!formData.full_name || !formData.email || !formData.role) return showToast('Ad, e-posta ve rol zorunlu', 'error')
    try {
      if (editingStaff) {
        const updates = { full_name: formData.full_name, email: formData.email?.toLowerCase(), phone: formData.phone, role: formData.role }
        if (formData.password_hash) updates.password_hash = formData.password_hash
        const { error } = await supabase.from('users').update(updates).eq('id', editingStaff.id)
        if (error) throw error
        showToast('Çalışan güncellendi', 'success')
      } else {
        if (!formData.password_hash) return showToast('Şifre zorunlu', 'error')
        const { error } = await supabase.from('users').insert({ 
          full_name: formData.full_name, 
          email: formData.email?.toLowerCase(), 
          phone: formData.phone, 
          role: formData.role, 
          password_hash: formData.password_hash,
          status: 'ACTIVE'
        })
        if (error) throw error
        showToast('Çalışan eklendi', 'success')
      }
      setShowModal(false); setEditingStaff(null); loadStaff()
    } catch (err) { 
      console.error('Staff save error:', err)
      showToast('Hata: ' + (err.message || err.details || 'Bilinmeyen hata'), 'error') 
    }
  }

  const handleEdit = (s) => {
    setEditingStaff(s)
    setFormData({ full_name: s.full_name, email: s.email, phone: s.phone || '', role: s.role, password_hash: '' })
    setShowModal(true)
  }

  const handleNew = () => {
    setEditingStaff(null)
    setFormData({ full_name: '', email: '', phone: '', role: 'SALES', password_hash: '' })
    setShowModal(true)
  }

  const roleOptions = [
    { value: 'SALES', label: 'Satış Temsilcisi' },
    { value: 'OPERATIONS', label: 'Operasyon' },
    { value: 'DRIVER', label: 'Şoför' },
    { value: 'ADMIN', label: 'Yönetici' },
  ]

  const roleBadge = (role) => {
    const colors = { ADMIN: 'bg-purple-100 text-purple-700', SUPER_ADMIN: 'bg-purple-100 text-purple-700', STAFF: 'bg-blue-100 text-blue-700', SALES: 'bg-emerald-100 text-emerald-700', OPERATIONS: 'bg-amber-100 text-amber-700', DRIVER: 'bg-sky-100 text-sky-700' }
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[role] || 'bg-gray-100 text-gray-700'}`}>{ROLE_LABELS[role] || role}</span>
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-500 text-sm">{staff.length} çalışan</p>
        <Button variant="primary" size="sm" icon={Plus} onClick={handleNew}>Yeni Çalışan</Button>
      </div>

      {loading ? <SkeletonTable rows={5} cols={5} /> : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ad Soyad</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">E-posta</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Telefon</th>
              <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
              <th className="text-right px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">İşlem</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="px-4 lg:px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-[#C41E3A] to-[#9A1A2E] rounded-full flex items-center justify-center text-white font-bold text-xs">{s.full_name?.charAt(0)}</div>
                      <p className="font-medium text-gray-900 text-sm">{s.full_name}</p>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-3 text-gray-600 text-sm hidden md:table-cell">{s.email}</td>
                  <td className="px-4 lg:px-6 py-3 text-gray-600 text-sm hidden sm:table-cell">{s.phone || '-'}</td>
                  <td className="px-4 lg:px-6 py-3">{roleBadge(s.role)}</td>
                  <td className="px-4 lg:px-6 py-3 text-right">
                    <button onClick={() => handleEdit(s)} className="text-gray-400 hover:text-[#C41E3A] p-1"><Edit className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && <EmptyState title="Henüz çalışan yok" description="Satış ve operasyon ekibinizi buradan yönetin." />}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingStaff(null) }} title={editingStaff ? 'Çalışan Düzenle' : 'Yeni Çalışan'} size="md">
        <div className="p-6 space-y-4">
          <Input label="Ad Soyad *" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
          <Input label="E-posta *" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          <Input label="Telefon" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          <Select label="Rol *" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} options={roleOptions} />
          <Input label={editingStaff ? 'Şifre (değiştirmek için)' : 'Şifre *'} type="password" value={formData.password_hash} onChange={e => setFormData({...formData, password_hash: e.target.value})} placeholder={editingStaff ? 'Boş bırakın korumak için' : ''} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setShowModal(false); setEditingStaff(null) }}>İptal</Button>
            <Button variant="primary" onClick={handleSave}>{editingStaff ? 'Güncelle' : 'Ekle'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}



export default StaffPage
