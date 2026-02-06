'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, fixStorageUrl } from '@/lib/supabase'
import {
  Package, Plus, Edit, Trash2, Search, ChevronRight, Image, FileText,
  Upload, X, Check, FolderPlus, Eye, Download, Camera, File, RefreshCw,
  ChevronDown, Filter
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

// Standart makine türleri listesi
const STANDARD_MACHINE_TYPES = {
  'AKÜLÜ MAKASLI PLATFORM': ['6M', '8M', '10M', '12M', '14M', '16M'],
  'DİZEL MAKASLI PLATFORM': ['12M', '18M', '22M'],
  'AKÜLÜ EKLEMLİ PLATFORM': ['15M', '18M', '20M', '22M'],
  'DİZEL EKLEMLİ PLATFORM': ['16M', '18M', '20M', '26M', '32M', '41M', '48M'],
  'DİZEL TELESKOPİK PLATFORM': ['23M', '28M', '38M', '43M', '48M', '51M', '58M'],
  'TELEHANDLER': ['4T 14M', '4T 18M'],
  'FORKLİFT DİZEL': ['3T', '5T', '7T', '10T', '16T', '25T', '32T'],
  'FORKLİFT AKÜLÜ': ['1.5T', '2T', '2.5T', '3T'],
  'ÖRÜMCEK PLATFORM': ['18M', '22M', '30M', '42M'],
  'DİKEY PLATFORM': ['6M', '8M', '10M', '12M'],
  'VINÇ': ['25T', '50T', '70T', '100T', '200T', '300T'],
  'KAMYON ÜSTÜ PLATFORM': ['18M', '22M', '28M', '32M', '42M', '56M'],
  'DİĞER': []
}

const turkishToLower = (str) => {
  if (!str) return ''
  return str.replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/Ş/g, 'ş')
    .replace(/Ğ/g, 'ğ').replace(/Ü/g, 'ü').replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç').toLowerCase()
}

const createSlug = (str) => {
  if (!str) return ''
  return str.replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g').replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o').replace(/Ç/g, 'c')
    .replace(/ç/g, 'c').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const MachinesPage = ({ showToast }) => {
  const [categories, setCategories] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedMachine, setSelectedMachine] = useState(null)
  
  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showMachineModal, setShowMachineModal] = useState(false)
  const [showDocsModal, setShowDocsModal] = useState(false)
  
  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [machineForm, setMachineForm] = useState({
    category_id: '',
    name: '',
    customName: '',
    description: '',
    daily_price: '',
    weekly_price: '',
    monthly_price: '',
    is_hidden: false
  })
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingMachine, setEditingMachine] = useState(null)
  
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

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
    } catch (err) {
      console.error('Load error:', err)
      showToast('Veriler yüklenemedi', 'error')
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  // Filtreleme
  const filteredCategories = categories.filter(c => {
    if (!search) return true
    return turkishToLower(c.name).includes(turkishToLower(search))
  })

  const filteredMachines = selectedCategory
    ? machines.filter(m => m.category_id === selectedCategory.id)
    : []

  // Kategori seçili iken makine türü seçenekleri
  const getMachineTypeOptions = () => {
    if (!machineForm.category_id) return []
    const category = categories.find(c => c.id === machineForm.category_id)
    if (!category) return []
    
    const categoryName = category.name.toUpperCase()
    const standardTypes = STANDARD_MACHINE_TYPES[categoryName] || []
    
    // Standart türlerden seçenekler oluştur
    const options = standardTypes.map(suffix => ({
      value: `${categoryName} ${suffix}`,
      label: `${categoryName} ${suffix}`
    }))
    
    // Mevcut makinelerden de ekle (duplicate olmayanları)
    const existingMachines = machines.filter(m => m.category_id === machineForm.category_id)
    existingMachines.forEach(m => {
      if (!options.find(o => o.value === m.name)) {
        options.push({ value: m.name, label: m.name })
      }
    })
    
    return options
  }

  // ============ KATEGORİ İŞLEMLERİ ============
  const openAddCategory = () => {
    setEditingCategory(null)
    setCategoryForm({ name: '', description: '' })
    setShowCategoryModal(true)
  }

  const openEditCategory = (cat) => {
    setEditingCategory(cat)
    setCategoryForm({ name: cat.name, description: cat.description || '' })
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
      const payload = {
        name: categoryForm.name,
        slug: slug,
        description: categoryForm.description || categoryForm.name,
        is_active: true
      }

      if (editingCategory) {
        await supabase.from('categories').update(payload).eq('id', editingCategory.id)
        showToast('Kategori güncellendi', 'success')
      } else {
        await supabase.from('categories').insert(payload)
        showToast('Kategori eklendi', 'success')
      }
      setShowCategoryModal(false)
      loadData()
    } catch (err) {
      showToast('Kayıt başarısız: ' + err.message, 'error')
    }
    setSaving(false)
  }

  const handleDeleteCategory = async (cat) => {
    if (!confirm(`"${cat.name}" kategorisini silmek istediğinize emin misiniz?`)) return
    try {
      await supabase.from('categories').update({ is_active: false }).eq('id', cat.id)
      showToast('Kategori silindi', 'success')
      if (selectedCategory?.id === cat.id) setSelectedCategory(null)
      loadData()
    } catch (err) {
      showToast('Silme başarısız', 'error')
    }
  }

  // ============ MAKİNE İŞLEMLERİ ============
  const openAddMachine = () => {
    setEditingMachine(null)
    setMachineForm({
      category_id: selectedCategory?.id || '',
      name: '',
      customName: '',
      description: '',
      daily_price: '',
      weekly_price: '',
      monthly_price: '',
      is_hidden: false
    })
    setShowMachineModal(true)
  }

  const openEditMachine = (machine) => {
    setEditingMachine(machine)
    setMachineForm({
      category_id: machine.category_id || '',
      name: machine.name || '',
      customName: '',
      description: machine.description || '',
      daily_price: machine.daily_price || '',
      weekly_price: machine.weekly_price || '',
      monthly_price: machine.monthly_price || '',
      is_hidden: machine.is_hidden || false
    })
    setShowMachineModal(true)
  }

  const handleSaveMachine = async () => {
    // İsim belirleme: dropdown'dan seçildi mi yoksa custom mu
    const machineName = machineForm.name === '__custom__' ? machineForm.customName : machineForm.name
    
    if (!machineName || !machineForm.category_id) {
      showToast('Makine türü ve kategori zorunlu', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: machineName,
        category_id: machineForm.category_id,
        description: machineForm.description || null,
        daily_price: machineForm.daily_price ? parseFloat(machineForm.daily_price) : null,
        weekly_price: machineForm.weekly_price ? parseFloat(machineForm.weekly_price) : null,
        monthly_price: machineForm.monthly_price ? parseFloat(machineForm.monthly_price) : null,
        is_hidden: machineForm.is_hidden
      }

      if (editingMachine) {
        await supabase.from('machines').update(payload).eq('id', editingMachine.id)
        showToast('Makine türü güncellendi', 'success')
      } else {
        await supabase.from('machines').insert(payload)
        showToast('Makine türü eklendi', 'success')
      }
      setShowMachineModal(false)
      loadData()
    } catch (err) {
      showToast('Kayıt başarısız: ' + err.message, 'error')
    }
    setSaving(false)
  }

  const handleDeleteMachine = async (machine) => {
    if (!confirm(`"${machine.name}" makine türünü silmek istediğinize emin misiniz?`)) return
    try {
      await supabase.from('machines').delete().eq('id', machine.id)
      showToast('Makine türü silindi', 'success')
      loadData()
    } catch (err) {
      showToast('Silme başarısız', 'error')
    }
  }

  // ============ DOSYA İŞLEMLERİ ============
  const openDocsModal = (machine) => {
    setSelectedMachine(machine)
    setShowDocsModal(true)
  }

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0]
    if (!file || !selectedMachine) return
    
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `machines/${selectedMachine.id}_${field}_${Date.now()}.${ext}`
      
      await supabase.storage.from('uploads').upload(fileName, file, { contentType: file.type, upsert: true })
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName)
      
      const updateData = {}
      updateData[field] = urlData.publicUrl
      await supabase.from('machines').update(updateData).eq('id', selectedMachine.id)
      
      showToast('Dosya yüklendi', 'success')
      setSelectedMachine({ ...selectedMachine, [field]: urlData.publicUrl })
      loadData()
    } catch (err) {
      showToast('Yükleme başarısız: ' + err.message, 'error')
    }
    setUploading(false)
    e.target.value = ''
  }

  if (loading) return <div className="p-6"><SkeletonCards count={6} /></div>

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sol Panel - Kategoriler */}
        <div className="lg:w-80 flex-shrink-0">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Kategoriler</h2>
              <Button size="sm" icon={Plus} onClick={openAddCategory}>Ekle</Button>
            </div>

            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Kategori ara..."
              className="mb-4"
            />

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredCategories.map(cat => {
                const machineCount = machines.filter(m => m.category_id === cat.id).length
                const isSelected = selectedCategory?.id === cat.id

                return (
                  <div
                    key={cat.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between group
                      ${isSelected ? 'bg-red-50 border-2 border-red-500' : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'}`}
                    onClick={() => setSelectedCategory(isSelected ? null : cat)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${isSelected ? 'text-red-700' : 'text-gray-900'}`}>
                        {cat.name}
                      </p>
                      <p className="text-xs text-gray-500">{machineCount} makine türü</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditCategory(cat) }}
                        className="p-1 hover:bg-white rounded"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat) }}
                        className="p-1 hover:bg-white rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                    <ChevronRight className={`w-5 h-5 ml-2 transition-transform ${isSelected ? 'rotate-90 text-red-500' : 'text-gray-400'}`} />
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Sağ Panel - Makineler */}
        <div className="flex-1">
          {selectedCategory ? (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedCategory.name}</h2>
                  <p className="text-sm text-gray-500">{filteredMachines.length} makine türü</p>
                </div>
                <Button icon={Plus} onClick={openAddMachine}>Makine Türü Ekle</Button>
              </div>

              {filteredMachines.length === 0 ? (
                <EmptyState icon={Package} title="Makine türü bulunamadı" description="Bu kategoriye henüz makine türü eklenmemiş." />
              ) : (
                <div className="space-y-3">
                  {filteredMachines.map(machine => (
                    <div key={machine.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between group hover:bg-gray-100">
                      <div className="flex items-center gap-4">
                        {machine.image_url ? (
                          <img src={fixStorageUrl(machine.image_url)} alt="" className="w-16 h-16 rounded-lg object-cover" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900">{machine.name}</h3>
                          {machine.description && (
                            <p className="text-sm text-gray-500 line-clamp-1">{machine.description}</p>
                          )}
                          <div className="flex gap-4 mt-1 text-sm">
                            {machine.daily_price && <span className="text-emerald-600">₺{machine.daily_price}/gün</span>}
                            {machine.weekly_price && <span className="text-blue-600">₺{machine.weekly_price}/hafta</span>}
                            {machine.monthly_price && <span className="text-purple-600">₺{machine.monthly_price}/ay</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" icon={Image} onClick={() => openDocsModal(machine)} title="Dosyalar" />
                        <Button size="sm" variant="ghost" icon={Edit} onClick={() => openEditMachine(machine)} title="Düzenle" />
                        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => handleDeleteMachine(machine)} className="text-red-500" title="Sil" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-8">
              <EmptyState icon={FolderPlus} title="Kategori seçin" description="Makine türlerini görmek için sol taraftan bir kategori seçin." />
            </Card>
          )}
        </div>
      </div>

      {/* Kategori Modal */}
      <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title={editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori'} size="sm">
        <div className="p-6 space-y-4">
          <Input
            label="Kategori Adı *"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Örn: AKÜLÜ MAKASLI PLATFORM"
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

      {/* Makine Modal */}
      <Modal isOpen={showMachineModal} onClose={() => setShowMachineModal(false)} title={editingMachine ? 'Makine Türü Düzenle' : 'Yeni Makine Türü'} size="md">
        <div className="p-6 space-y-4">
          <Select
            label="Kategori *"
            value={machineForm.category_id}
            onChange={(e) => setMachineForm(prev => ({ ...prev, category_id: e.target.value, name: '', customName: '' }))}
          >
            <option value="">Seçin</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          {machineForm.category_id && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Makine Türü *</label>
                <select
                  value={machineForm.name}
                  onChange={(e) => setMachineForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Seçin veya yeni ekleyin</option>
                  {getMachineTypeOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                  <option value="__custom__">+ Yeni Makine Türü Ekle</option>
                </select>
              </div>

              {machineForm.name === '__custom__' && (
                <Input
                  label="Yeni Makine Türü Adı *"
                  value={machineForm.customName}
                  onChange={(e) => setMachineForm(prev => ({ ...prev, customName: e.target.value }))}
                  placeholder="Örn: AKÜLÜ EKLEMLİ PLATFORM 15M"
                />
              )}
            </>
          )}

          <Textarea
            label="Açıklama"
            value={machineForm.description}
            onChange={(e) => setMachineForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Müşterinin göreceği açıklama..."
            rows={2}
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Günlük (₺)"
              type="number"
              value={machineForm.daily_price}
              onChange={(e) => setMachineForm(prev => ({ ...prev, daily_price: e.target.value }))}
            />
            <Input
              label="Haftalık (₺)"
              type="number"
              value={machineForm.weekly_price}
              onChange={(e) => setMachineForm(prev => ({ ...prev, weekly_price: e.target.value }))}
            />
            <Input
              label="Aylık (₺)"
              type="number"
              value={machineForm.monthly_price}
              onChange={(e) => setMachineForm(prev => ({ ...prev, monthly_price: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={machineForm.is_hidden}
              onChange={(e) => setMachineForm(prev => ({ ...prev, is_hidden: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-700">Müşterilerden gizle</span>
          </label>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowMachineModal(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleSaveMachine} loading={saving}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      {/* Dosyalar Modal */}
      <Modal isOpen={showDocsModal} onClose={() => setShowDocsModal(false)} title="Dosyalar" size="md">
        <div className="p-6 space-y-4">
          {selectedMachine && (
            <>
              <p className="text-sm text-gray-600 font-medium">{selectedMachine.name}</p>
              
              {[
                { key: 'image_url', label: 'Fotoğraf', accept: 'image/*', icon: Camera },
                { key: 'manual_url', label: 'Kullanım Kılavuzu', accept: '.pdf', icon: FileText },
                { key: 'catalog_url', label: 'Katalog', accept: '.pdf', icon: File },
                { key: 'other_doc_url', label: 'Diğer', accept: '.pdf,.doc,.docx', icon: File }
              ].map(doc => {
                const hasFile = selectedMachine[doc.key]
                const Icon = doc.icon
                
                return (
                  <div key={doc.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {hasFile ? <Check className="w-4 h-4 text-emerald-500" /> : <Icon className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">{doc.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasFile ? (
                        <a href={selectedMachine[doc.key]} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Görüntüle</a>
                      ) : (
                        <label className="cursor-pointer">
                          <input type="file" accept={doc.accept} onChange={(e) => handleFileUpload(e, doc.key)} className="hidden" disabled={uploading} />
                          <span className={`text-sm ${uploading ? 'text-gray-400' : 'text-blue-600 hover:underline'}`}>
                            {uploading ? 'Yükleniyor...' : 'Yükle'}
                          </span>
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
    </div>
  )
}

export default MachinesPage
