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

const CategoriesPage = ({ showToast }) => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({})

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async () => {
    try {
      const slug = formData.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const data = { ...formData, slug }
      if (formData.id) { await supabase.from('categories').update(data).eq('id', formData.id); showToast('Kategori güncellendi', 'success') }
      else { await supabase.from('categories').insert([data]); showToast('Kategori eklendi', 'success') }
      setShowModal(false); setFormData({}); loadData()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
  }

  if (loading) return <div className="p-6"><SkeletonCards count={6} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="primary" size="sm" icon={Plus} onClick={() => { setFormData({}); setShowModal(true) }}>Yeni Kategori</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <Card key={cat.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#F7B500]/10 rounded-xl flex items-center justify-center text-2xl">{cat.icon || '📦'}</div>
              <button onClick={() => { setFormData(cat); setShowModal(true) }} className="p-2 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4 text-gray-500" /></button>
            </div>
            <h3 className="font-semibold text-gray-900">{cat.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{cat.description || 'Açıklama yok'}</p>
          </Card>
        ))}
      </div>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={formData.id ? 'Kategori Düzenle' : 'Yeni Kategori'} size="sm">
        <div className="p-6 space-y-4">
          <Input label="Kategori Adı *" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <Input label="İkon" value={formData.icon || ''} onChange={e => setFormData({...formData, icon: e.target.value})} placeholder="forklift, crane, etc." />
          <Textarea label="Açıklama" rows={3} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowModal(false)}>İptal</Button>
          <Button variant="primary" icon={Save} onClick={handleSave}>Kaydet</Button>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MACHINES PAGE (with pagination)
// ═══════════════════════════════════════════════════════════════════════════



export default CategoriesPage
