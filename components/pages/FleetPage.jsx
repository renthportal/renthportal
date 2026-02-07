'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, fixStorageUrl } from '@/lib/supabase'
import {
  Truck, Plus, Edit, Trash2, Search, Upload, Download, X, Save,
  Image, FileText, Filter, RefreshCw, MapPin, User, Calendar,
  CheckCircle, AlertCircle, Clock, Wrench, FileSpreadsheet, Eye,
  ChevronDown, ChevronRight, Camera, File, Check, Building, FolderPlus, Package
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import SearchBar from '@/components/ui/SearchBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCards } from '@/components/ui/Skeleton'
import * as XLSX from 'xlsx'

// Türkçe arama
const turkishToLower = (str) => {
  if (!str) return ''
  return str
    .replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/Ş/g, 'ş')
    .replace(/Ğ/g, 'ğ').replace(/Ü/g, 'ü').replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç').toLowerCase()
}

// Slug oluştur
const createSlug = (str) => {
  if (!str) return ''
  return str
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g').replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o').replace(/Ç/g, 'c')
    .replace(/ç/g, 'c').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Durum seçenekleri
const STATUS_OPTIONS = [
  { value: 'available', label: 'Müsait', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  { value: 'rented', label: 'Kirada', color: 'bg-blue-100 text-blue-700', icon: User },
  { value: 'maintenance', label: 'Bakımda', color: 'bg-yellow-100 text-yellow-700', icon: Wrench },
  { value: 'broken', label: 'Arızalı', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  { value: 'reserved', label: 'Rezerve', color: 'bg-purple-100 text-purple-700', icon: Clock }
]

// Garaj seçenekleri
const GARAGE_OPTIONS = [
  { value: 'samandira', label: 'Samandıra Garaj' },
  { value: 'pasakoy', label: 'Paşaköy Garaj' },
  { value: 'yalova', label: 'Yalova Garaj' },
  { value: 'izmir', label: 'İzmir Garaj' },
  { value: 'mersin', label: 'Mersin Garaj' }
]

// Dosya tipleri
const DOC_TYPES = [
  { key: 'image', label: 'Resim', accept: 'image/*', icon: Camera },
  { key: 'ruhsat', label: 'Ruhsat', accept: '.pdf,.jpg,.jpeg,.png', icon: FileText },
  { key: 'muayene', label: 'Muayene', accept: '.pdf,.jpg,.jpeg,.png', icon: FileText },
  { key: 'sigorta', label: 'Sigorta', accept: '.pdf,.jpg,.jpeg,.png', icon: FileText },
  { key: 'katalog', label: 'Katalog', accept: '.pdf', icon: File }
]

const FleetPage = ({ showToast }) => {
  const [fleet, setFleet] = useState([])
  const [categories, setCategories] = useState([])
  const [machines, setMachines] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filtreler
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [machineFilter, setMachineFilter] = useState('all')
  const [garageFilter, setGarageFilter] = useState('all')
  
  // Modals
  const [showModal, setShowModal] = useState(false)
  const [showDocsModal, setShowDocsModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showMachineModal, setShowMachineModal] = useState(false)
  const [selectedFleet, setSelectedFleet] = useState(null)
  
  // Form - Fleet
  const [form, setForm] = useState({
    serial_number: '',
    category_id: '',
    machine_id: '',
    status: 'available',
    location_type: 'garage',
    garage: 'samandira',
    company_id: '',
    customer_address: '',
    muayene_tarihi: '',
    sigorta_bitis: '',
    notes: ''
  })

  // Form - Kategori
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })

  // Form - Makine Türü
  const [machineForm, setMachineForm] = useState({ name: '', category_id: '', description: '' })
  
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importData, setImportData] = useState([])
  const [importing, setImporting] = useState(false)

  // Veri yükle
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name')
      setCategories(cats || [])

      const { data: machs } = await supabase
        .from('machines')
        .select('*, category:categories(id, name)')
        .order('name')
      setMachines(machs || [])

      const { data: custs } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')
      setCustomers(custs || [])

      const { data: fleetData } = await supabase
        .from('fleet')
        .select(`
          *,
          category:categories(id, name),
          machine:machines(id, name),
          company:companies(id, name)
        `)
        .order('serial_number')
      setFleet(fleetData || [])
    } catch (err) {
      console.error('Load error:', err)
      showToast('Veriler yüklenemedi', 'error')
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  // Kategori filtresine göre makine listesi
  const filteredMachinesForFilter = categoryFilter !== 'all'
    ? machines.filter(m => m.category_id === categoryFilter)
    : machines

  // Form için kategori filtresine göre makine listesi
  const filteredMachinesForForm = form.category_id 
    ? machines.filter(m => m.category_id === form.category_id)
    : machines

  // Makine türü form için kategori filtresine göre
  const filteredMachinesForMachineForm = machineForm.category_id
    ? machines.filter(m => m.category_id === machineForm.category_id)
    : machines

  // Filtreleme
  const filteredFleet = fleet.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (categoryFilter !== 'all' && item.category_id !== categoryFilter) return false
    if (machineFilter !== 'all' && item.machine_id !== machineFilter) return false
    if (garageFilter !== 'all' && item.garage !== garageFilter) return false
    if (search) {
      const s = turkishToLower(search)
      const serial = turkishToLower(item.serial_number)
      const cat = turkishToLower(item.category?.name)
      const mach = turkishToLower(item.machine?.name)
      const cust = turkishToLower(item.company?.name)
      return serial.includes(s) || cat.includes(s) || mach.includes(s) || cust.includes(s)
    }
    return true
  })

  // İstatistikler
  const stats = {
    total: fleet.length,
    available: fleet.filter(f => f.status === 'available').length,
    rented: fleet.filter(f => f.status === 'rented').length,
    maintenance: fleet.filter(f => f.status === 'maintenance').length,
    broken: fleet.filter(f => f.status === 'broken').length,
    reserved: fleet.filter(f => f.status === 'reserved').length
  }

  // ============ KATEGORİ EKLE ============
  const openCategoryModal = () => {
    setCategoryForm({ name: '', description: '' })
    setShowCategoryModal(true)
  }

  const handleSaveCategory = async () => {
    if (!categoryForm.name) {
      showToast('Kategori adı zorunlu', 'error')
      return
    }
    setSaving(true)
    try {
      const slug = createSlug(categoryForm.name)
      const { error } = await supabase
        .from('categories')
        .insert({
          name: categoryForm.name,
          slug: slug,
          description: categoryForm.description || categoryForm.name,
          is_active: true
        })
      if (error) throw error
      showToast('Kategori eklendi', 'success')
      setShowCategoryModal(false)
      loadData()
    } catch (err) {
      showToast('Kayıt başarısız: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // ============ MAKİNE TÜRÜ EKLE ============
  const openMachineModal = () => {
    setMachineForm({ name: '', category_id: '', description: '' })
    setShowMachineModal(true)
  }

  const handleSaveMachine = async () => {
    if (!machineForm.name || !machineForm.category_id) {
      showToast('Makine türü ve kategori zorunlu', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('machines')
        .insert({
          name: machineForm.name,
          category_id: machineForm.category_id,
          description: machineForm.description || null
        })
      if (error) throw error
      showToast('Makine türü eklendi', 'success')
      setShowMachineModal(false)
      loadData()
    } catch (err) {
      showToast('Kayıt başarısız: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // ============ FİLO KAYIT ============
  const openAddModal = () => {
    setSelectedFleet(null)
    setForm({
      serial_number: '',
      category_id: '',
      machine_id: '',
      status: 'available',
      location_type: 'garage',
      garage: 'samandira',
      company_id: '',
      customer_address: '',
      muayene_tarihi: '',
      sigorta_bitis: '',
      notes: ''
    })
    setShowModal(true)
  }

  const openEditModal = (item) => {
    setSelectedFleet(item)
    setForm({
      serial_number: item.serial_number || '',
      category_id: item.category_id || '',
      machine_id: item.machine_id || '',
      status: item.status || 'available',
      location_type: item.location_type || 'garage',
      garage: item.garage || 'samandira',
      company_id: item.company_id || '',
      customer_address: item.customer_address || '',
      muayene_tarihi: item.muayene_tarihi || '',
      sigorta_bitis: item.sigorta_bitis || '',
      notes: item.notes || ''
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.serial_number) {
      showToast('Seri numarası zorunlu', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        serial_number: form.serial_number,
        category_id: form.category_id || null,
        machine_id: form.machine_id || null,
        status: form.status,
        location_type: form.status === 'rented' ? 'customer' : 'garage',
        garage: form.status !== 'rented' ? form.garage : null,
        company_id: form.status === 'rented' ? form.company_id || null : null,
        customer_address: form.status === 'rented' ? form.customer_address : null,
        muayene_tarihi: form.muayene_tarihi || null,
        sigorta_bitis: form.sigorta_bitis || null,
        notes: form.notes || null
      }

      if (selectedFleet) {
        const { error } = await supabase.from('fleet').update(payload).eq('id', selectedFleet.id)
        if (error) throw error
        showToast('Kayıt güncellendi', 'success')
      } else {
        const { error } = await supabase.from('fleet').insert(payload)
        if (error) throw error
        showToast('Kayıt eklendi', 'success')
      }
      setShowModal(false)
      loadData()
    } catch (err) {
      showToast('Kayıt başarısız: ' + err.message, 'error')
    }
    setSaving(false)
  }

  const handleDelete = async (item) => {
    if (!confirm(`"${item.serial_number}" kaydını silmek istediğinize emin misiniz?`)) return
    try {
      const { error } = await supabase.from('fleet').delete().eq('id', item.id)
      if (error) throw error
      showToast('Kayıt silindi', 'success')
      loadData()
    } catch (err) {
      showToast('Silme başarısız: ' + err.message, 'error')
    }
  }

  // ============ DOSYA İŞLEMLERİ ============
  const openDocsModal = (item) => {
    setSelectedFleet(item)
    setShowDocsModal(true)
  }

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files?.[0]
    if (!file || !selectedFleet) return
    
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `fleet/${selectedFleet.id}_${docType}_${Date.now()}.${ext}`
      
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, file, { contentType: file.type, upsert: true })
      
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl
      
      const updateData = {}
      updateData[`${docType}_url`] = publicUrl
      
      await supabase.from('fleet').update(updateData).eq('id', selectedFleet.id)
      
      showToast('Dosya yüklendi', 'success')
      setSelectedFleet({ ...selectedFleet, [`${docType}_url`]: publicUrl })
      loadData()
    } catch (err) {
      showToast('Yükleme başarısız: ' + err.message, 'error')
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleFileDelete = async (docType) => {
    if (!selectedFleet) return
    try {
      const updateData = {}
      updateData[`${docType}_url`] = null
      await supabase.from('fleet').update(updateData).eq('id', selectedFleet.id)
      showToast('Dosya silindi', 'success')
      setSelectedFleet({ ...selectedFleet, [`${docType}_url`]: null })
      loadData()
    } catch (err) {
      showToast('Silme başarısız', 'error')
    }
  }

  // ============ EXCEL İŞLEMLERİ ============
  const handleExcelImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)
        
        const processed = data.map(row => ({
          category_name: row['KATEGORİ'] || row['KATEGORI'] || '',
          machine_name: row['MAKİNE TÜRÜ'] || row['MAKINE TURU'] || '',
          serial_number: String(row['SERİ NO'] || row['SERI NO'] || '').trim()
        })).filter(r => r.serial_number)
        
        setImportData(processed)
        setShowImportModal(true)
      } catch (err) {
        showToast('Excel okunamadı: ' + err.message, 'error')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const processImport = async () => {
    if (importData.length === 0) return
    
    setImporting(true)
    let successCount = 0
    let errorCount = 0
    
    for (const row of importData) {
      try {
        let categoryId = null
        if (row.category_name) {
          const cat = categories.find(c => 
            turkishToLower(c.name).includes(turkishToLower(row.category_name)) ||
            turkishToLower(row.category_name).includes(turkishToLower(c.name))
          )
          categoryId = cat?.id || null
        }
        
        let machineId = null
        if (row.machine_name) {
          const mach = machines.find(m => 
            turkishToLower(m.name) === turkishToLower(row.machine_name) ||
            turkishToLower(m.name).includes(turkishToLower(row.machine_name))
          )
          machineId = mach?.id || null
        }
        
        const { error } = await supabase.from('fleet').insert({
          serial_number: row.serial_number,
          category_id: categoryId,
          machine_id: machineId,
          status: 'available',
          location_type: 'garage',
          garage: 'samandira'
        })
        
        if (error) {
          errorCount++
        } else {
          successCount++
        }
      } catch (err) {
        errorCount++
      }
    }
    
    showToast(`${successCount} kayıt eklendi, ${errorCount} hata`, successCount > 0 ? 'success' : 'error')
    setShowImportModal(false)
    setImportData([])
    setImporting(false)
    loadData()
  }

  const handleExcelExport = () => {
    const exportData = fleet.map(item => ({
      'KATEGORİ': item.category?.name || '',
      'MAKİNE TÜRÜ': item.machine?.name || '',
      'SERİ NO': item.serial_number,
      'DURUM': STATUS_OPTIONS.find(s => s.value === item.status)?.label || '',
      'KONUM': item.location_type === 'customer' 
        ? (item.company?.name || '') + ' - ' + (item.customer_address || '')
        : GARAGE_OPTIONS.find(g => g.value === item.garage)?.label || '',
      'MÜŞTERİ': item.company?.name || ''
    }))
    
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Filo')
    XLSX.writeFile(wb, 'Filo_Export.xlsx')
    showToast('Excel indirildi', 'success')
  }

  // ============ YARDIMCI COMPONENTLER ============
  const StatusBadge = ({ status }) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status)
    if (!opt) return null
    const Icon = opt.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${opt.color}`}>
        <Icon className="w-3 h-3" />
        {opt.label}
      </span>
    )
  }

  const LocationDisplay = ({ item }) => {
    if (item.status === 'rented' && item.company) {
      return (
        <div className="flex items-center gap-1 text-sm">
          <Building className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-blue-600">{item.company.name}</span>
          {item.customer_address && (
            <span className="text-gray-500 text-xs ml-1">({item.customer_address})</span>
          )}
        </div>
      )
    }
    const garage = GARAGE_OPTIONS.find(g => g.value === item.garage)
    return (
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <MapPin className="w-4 h-4 text-gray-400" />
        {garage?.label || 'Belirtilmemiş'}
      </div>
    )
  }

  if (loading) return <div className="p-6"><SkeletonCards count={6} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Filo Envanteri</h1>
          <p className="text-sm text-gray-500">{fleet.length} araç kayıtlı</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={loadData}>Yenile</Button>
          <Button variant="outline" icon={Download} onClick={handleExcelExport}>Excel İndir</Button>
          <label className="cursor-pointer">
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="hidden" />
            <span className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50">
              <Upload className="w-4 h-4" /> Excel Yükle
            </span>
          </label>
          <Button variant="outline" icon={FolderPlus} onClick={openCategoryModal}>Kategori Ekle</Button>
          <Button variant="outline" icon={Package} onClick={openMachineModal}>Makine Türü Ekle</Button>
          <Button icon={Plus} onClick={openAddModal}>Yeni Makine Ekle</Button>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Toplam</p>
        </Card>
        <Card className="p-4 text-center bg-emerald-50 border-emerald-200">
          <p className="text-2xl font-bold text-emerald-600">{stats.available}</p>
          <p className="text-xs text-emerald-600">Müsait</p>
        </Card>
        <Card className="p-4 text-center bg-blue-50 border-blue-200">
          <p className="text-2xl font-bold text-blue-600">{stats.rented}</p>
          <p className="text-xs text-blue-600">Kirada</p>
        </Card>
        <Card className="p-4 text-center bg-yellow-50 border-yellow-200">
          <p className="text-2xl font-bold text-yellow-600">{stats.maintenance}</p>
          <p className="text-xs text-yellow-600">Bakımda</p>
        </Card>
        <Card className="p-4 text-center bg-red-50 border-red-200">
          <p className="text-2xl font-bold text-red-600">{stats.broken}</p>
          <p className="text-xs text-red-600">Arızalı</p>
        </Card>
        <Card className="p-4 text-center bg-purple-50 border-purple-200">
          <p className="text-2xl font-bold text-purple-600">{stats.reserved}</p>
          <p className="text-xs text-purple-600">Rezerve</p>
        </Card>
      </div>

      {/* Filtreler */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Seri no, kategori, müşteri ara..."
            className="lg:col-span-2"
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tüm Durumlar</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setMachineFilter('all') }}>
            <option value="all">Tüm Kategoriler</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}>
            <option value="all">Tüm Makine Türleri</option>
            {filteredMachinesForFilter.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
          <Select value={garageFilter} onChange={(e) => setGarageFilter(e.target.value)}>
            <option value="all">Tüm Garajlar</option>
            {GARAGE_OPTIONS.map(g => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Liste */}
      {filteredFleet.length === 0 ? (
        <EmptyState icon={Truck} title="Kayıt bulunamadı" description="Arama kriterlerinize uygun araç yok." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seri No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Makine Türü</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Konum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dosyalar</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredFleet.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.image_url ? (
                          <img src={fixStorageUrl(item.image_url)} alt="" className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                            <Truck className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{item.serial_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.category?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.machine?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <LocationDisplay item={item} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {item.ruhsat_url && <span title="Ruhsat" className="w-2 h-2 bg-green-500 rounded-full"></span>}
                        {item.muayene_url && <span title="Muayene" className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                        {item.sigorta_url && <span title="Sigorta" className="w-2 h-2 bg-purple-500 rounded-full"></span>}
                        {item.katalog_url && <span title="Katalog" className="w-2 h-2 bg-orange-500 rounded-full"></span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Image} onClick={() => openDocsModal(item)} title="Dosyalar" />
                        <Button size="sm" variant="ghost" icon={Edit} onClick={() => openEditModal(item)} title="Düzenle" />
                        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => handleDelete(item)} className="text-red-500" title="Sil" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
            Toplam {filteredFleet.length} kayıt gösteriliyor
          </div>
        </Card>
      )}

      {/* Kategori Ekle Modal */}
      <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Yeni Kategori" size="sm">
        <div className="p-6 space-y-4">
          <Input
            label="Kategori Adı *"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Örn: AKÜLÜ EKLEMLİ PLATFORM"
          />
          <Textarea
            label="Açıklama"
            value={categoryForm.description}
            onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
          />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowCategoryModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleSaveCategory} loading={saving}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      {/* Makine Türü Ekle Modal */}
      <Modal isOpen={showMachineModal} onClose={() => setShowMachineModal(false)} title="Yeni Makine Türü" size="sm">
        <div className="p-6 space-y-4">
          <Select
            label="Kategori *"
            value={machineForm.category_id}
            onChange={(e) => setMachineForm(prev => ({ ...prev, category_id: e.target.value }))}
          >
            <option value="">Seçin</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Input
            label="Makine Türü *"
            value={machineForm.name}
            onChange={(e) => setMachineForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Örn: AKÜLÜ EKLEMLİ PLATFORM 15M"
          />
          <Textarea
            label="Açıklama"
            value={machineForm.description}
            onChange={(e) => setMachineForm(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
          />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowMachineModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleSaveMachine} loading={saving}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      {/* Fleet Ekle/Düzenle Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={selectedFleet ? 'Kayıt Düzenle' : 'Yeni Kayıt'} size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Seri Numarası *"
              value={form.serial_number}
              onChange={(e) => setForm(prev => ({ ...prev, serial_number: e.target.value }))}
              placeholder="Örn: 101501236"
            />
            <Select
              label="Durum"
              value={form.status}
              onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Kategori"
              value={form.category_id}
              onChange={(e) => setForm(prev => ({ ...prev, category_id: e.target.value, machine_id: '' }))}
            >
              <option value="">Seçin</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select
              label="Makine Türü"
              value={form.machine_id}
              onChange={(e) => setForm(prev => ({ ...prev, machine_id: e.target.value }))}
            >
              <option value="">Seçin</option>
              {filteredMachinesForForm.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>

          {form.status === 'rented' ? (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-700">Kiralama Bilgileri</p>
              <Select
                label="Müşteri"
                value={form.company_id}
                onChange={(e) => setForm(prev => ({ ...prev, company_id: e.target.value }))}
              >
                <option value="">Seçin</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Input
                label="Teslimat Adresi"
                value={form.customer_address}
                onChange={(e) => setForm(prev => ({ ...prev, customer_address: e.target.value }))}
                placeholder="Makinenin bulunduğu adres"
              />
            </div>
          ) : (
            <Select
              label="Garaj"
              value={form.garage}
              onChange={(e) => setForm(prev => ({ ...prev, garage: e.target.value }))}
            >
              {GARAGE_OPTIONS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </Select>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Muayene Tarihi" type="date" value={form.muayene_tarihi} onChange={(e) => setForm(prev => ({ ...prev, muayene_tarihi: e.target.value }))} />
            <Input label="Sigorta Bitiş" type="date" value={form.sigorta_bitis} onChange={(e) => setForm(prev => ({ ...prev, sigorta_bitis: e.target.value }))} />
          </div>

          <Textarea label="Notlar" value={form.notes} onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} />

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleSave} loading={saving}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      {/* Dosyalar Modal */}
      <Modal isOpen={showDocsModal} onClose={() => setShowDocsModal(false)} title="Dosyalar" size="md">
        <div className="p-6 space-y-4">
          {selectedFleet && (
            <>
              <p className="text-sm text-gray-600 font-medium">{selectedFleet.serial_number}</p>
              
              {DOC_TYPES.map(doc => {
                const hasFile = selectedFleet[`${doc.key}_url`]
                const Icon = doc.icon
                
                return (
                  <div key={doc.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {hasFile ? <Check className="w-4 h-4 text-emerald-500" /> : <Icon className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">{doc.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasFile ? (
                        <>
                          <a href={selectedFleet[`${doc.key}_url`]} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Görüntüle</a>
                          <button onClick={() => handleFileDelete(doc.key)} className="text-red-500 hover:text-red-700 p-1"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <label className="cursor-pointer">
                          <input type="file" accept={doc.accept} onChange={(e) => handleFileUpload(e, doc.key)} className="hidden" disabled={uploading} />
                          <span className={`text-sm ${uploading ? 'text-gray-400' : 'text-blue-600 hover:underline'}`}>{uploading ? 'Yükleniyor...' : 'Yükle'}</span>
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
              <Button variant="outline" className="w-full" onClick={() => setShowDocsModal(false)}>Kapat</Button>
            </>
          )}
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Excel Import" size="lg">
        <div className="p-6 space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700"><strong>{importData.length}</strong> kayıt bulundu.</p>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-left">Kategori</th>
                  <th className="px-2 py-1 text-left">Makine Türü</th>
                  <th className="px-2 py-1 text-left">Seri No</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {importData.slice(0, 20).map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1">{row.category_name}</td>
                    <td className="px-2 py-1">{row.machine_name}</td>
                    <td className="px-2 py-1 font-mono">{row.serial_number}</td>
                  </tr>
                ))}
                {importData.length > 20 && (
                  <tr><td colSpan={3} className="px-2 py-2 text-center text-gray-500">... ve {importData.length - 20} kayıt daha</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setShowImportModal(false); setImportData([]) }}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={processImport} loading={importing}>İçe Aktar ({importData.length})</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default FleetPage
