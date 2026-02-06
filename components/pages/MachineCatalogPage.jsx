'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { supabase, fixStorageUrl } from '@/lib/supabase'
import {
  Package, Search, Filter, Eye, Heart, ChevronRight, ChevronDown,
  Check, X, FileText, Info, Scale, Send, RefreshCw, Layers
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import Select from '@/components/ui/Select'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCards } from '@/components/ui/Skeleton'

// Türkçe karakterleri normalize et
const turkishToLower = (str) => {
  if (!str) return ''
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ş/g, 'ş')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç')
    .toLowerCase()
}

const MachineCatalogPage = ({ user, showToast, onRequestQuote }) => {
  const [machines, setMachines] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [expandedCategory, setExpandedCategory] = useState(null)
  
  // Detay modal
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // Karşılaştırma
  const [compareList, setCompareList] = useState([])
  const [showCompareModal, setShowCompareModal] = useState(false)
  
  // Favoriler (localStorage)
  const [favorites, setFavorites] = useState([])

  useEffect(() => {
    const savedFavs = localStorage.getItem('machine_favorites')
    if (savedFavs) setFavorites(JSON.parse(savedFavs))
  }, [])

  const saveFavorites = (favs) => {
    setFavorites(favs)
    localStorage.setItem('machine_favorites', JSON.stringify(favs))
  }

  const toggleFavorite = (machineId) => {
    if (favorites.includes(machineId)) {
      saveFavorites(favorites.filter(id => id !== machineId))
    } else {
      saveFavorites([...favorites, machineId])
    }
  }

  const isFavorite = (machineId) => favorites.includes(machineId)

  useEffect(() => {
    const loadData = async () => {
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
          .or('is_hidden.is.null,is_hidden.eq.false')
          .order('name')
        setMachines(machs || [])
      } catch (err) {
        console.error('Load error:', err)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  // Filtreleme - Türkçe karakter desteği ile
  const filteredMachines = useMemo(() => {
    return machines.filter(m => {
      if (categoryFilter !== 'all' && m.category_id !== categoryFilter) return false
      if (search) {
        const s = turkishToLower(search)
        const name = turkishToLower(m.name)
        const catName = turkishToLower(m.category?.name)
        const desc = turkishToLower(m.description)
        return name.includes(s) || catName.includes(s) || desc.includes(s)
      }
      return true
    })
  }, [machines, search, categoryFilter])

  // Kategoriye göre gruplama
  const groupedMachines = useMemo(() => {
    return categories.map(cat => ({
      category: cat,
      machines: filteredMachines.filter(m => m.category_id === cat.id)
    })).filter(g => g.machines.length > 0)
  }, [categories, filteredMachines])

  // Karşılaştırma
  const toggleCompare = (machine) => {
    if (compareList.find(m => m.id === machine.id)) {
      setCompareList(compareList.filter(m => m.id !== machine.id))
    } else {
      if (compareList.length >= 3) {
        showToast('En fazla 3 makine karşılaştırabilirsiniz', 'error')
        return
      }
      setCompareList([...compareList, machine])
    }
  }

  const isInCompare = (id) => compareList.some(m => m.id === id)

  // Detay aç
  const openDetail = (machine) => {
    setSelectedMachine(machine)
    setShowDetailModal(true)
  }

  // Teklif iste
  const requestQuote = (machine) => {
    if (onRequestQuote) {
      onRequestQuote(machine)
    }
  }

  // Spec'leri parse et
  const parseSpecs = (specs) => {
    if (!specs) return []
    if (Array.isArray(specs)) return specs
    if (typeof specs === 'object') return Object.entries(specs).map(([key, value]) => ({ key, value }))
    return []
  }

  // Fiyat gösterimi
  const PriceDisplay = ({ machine, size = 'md' }) => {
    const hasAnyPrice = machine.daily_rate || machine.weekly_rate || machine.monthly_rate
    if (!hasAnyPrice) return null

    if (size === 'sm') {
      return (
        <div className="flex flex-wrap gap-2 text-xs">
          {machine.daily_rate && (
            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded">
              ₺{machine.daily_rate.toLocaleString('tr-TR')}/gün
            </span>
          )}
          {machine.weekly_rate && (
            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded">
              ₺{machine.weekly_rate.toLocaleString('tr-TR')}/hafta
            </span>
          )}
          {machine.monthly_rate && (
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-medium">
              ₺{machine.monthly_rate.toLocaleString('tr-TR')}/ay
            </span>
          )}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-3 gap-2 text-center">
        {machine.daily_rate && (
          <div className="p-2 bg-emerald-50 rounded-lg">
            <p className="text-lg font-bold text-emerald-700">₺{machine.daily_rate.toLocaleString('tr-TR')}</p>
            <p className="text-xs text-emerald-600">Günlük</p>
          </div>
        )}
        {machine.weekly_rate && (
          <div className="p-2 bg-emerald-50 rounded-lg">
            <p className="text-lg font-bold text-emerald-700">₺{machine.weekly_rate.toLocaleString('tr-TR')}</p>
            <p className="text-xs text-emerald-600">Haftalık</p>
          </div>
        )}
        {machine.monthly_rate && (
          <div className="p-2 bg-emerald-100 rounded-lg">
            <p className="text-lg font-bold text-emerald-700">₺{machine.monthly_rate.toLocaleString('tr-TR')}</p>
            <p className="text-xs text-emerald-600">Aylık</p>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="p-6"><SkeletonCards count={6} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Makineler</h1>
        </div>
      </div>

      {/* Karşılaştırma Çubuğu */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Scale className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Makine Karşılaştırma</h3>
              <p className="text-sm text-gray-600">
                {compareList.length === 0 
                  ? 'Karşılaştırmak için makine kartlarındaki ölçek ikonuna tıklayın' 
                  : `${compareList.length} makine seçildi (en fazla 3)`
                }
              </p>
            </div>
          </div>
          
          {compareList.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                {compareList.map(m => (
                  <div key={m.id} className="flex items-center gap-1 px-2 py-1 bg-white rounded-full text-sm">
                    <span className="truncate max-w-[100px]">{m.name}</span>
                    <button onClick={() => toggleCompare(m)} className="text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button icon={Scale} onClick={() => setShowCompareModal(true)}>
                Karşılaştır
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Makine ara..."
            className="flex-1"
          />
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-56"
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Favoriler */}
      {favorites.length > 0 && categoryFilter === 'all' && !search && (
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            Favorilerim
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {machines.filter(m => favorites.includes(m.id)).map(machine => (
              <div 
                key={machine.id}
                className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                onClick={() => openDetail(machine)}
              >
                <div className="w-full h-16 bg-white rounded mb-2 flex items-center justify-center overflow-hidden">
                  {machine.image_url ? (
                    <img src={fixStorageUrl(machine.image_url)} alt="" className="h-full object-contain" />
                  ) : (
                    <Package className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <p className="text-xs font-medium text-gray-900 truncate">{machine.name}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Machine List */}
      {groupedMachines.length === 0 ? (
        <EmptyState icon={Package} title="Makine bulunamadı" description="Arama kriterlerinize uygun makine yok." />
      ) : (
        <div className="space-y-4">
          {groupedMachines.map(({ category, machines: catMachines }) => (
            <Card key={category.id} className="overflow-hidden">
              <div 
                className="p-4 bg-gradient-to-r from-gray-50 to-white border-b cursor-pointer hover:from-gray-100 flex items-center justify-between"
                onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Layers className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{category.name}</h3>
                    <p className="text-xs text-gray-500">{catMachines.length} makine</p>
                  </div>
                </div>
                {expandedCategory === category.id ? 
                  <ChevronDown className="w-5 h-5 text-gray-400" /> : 
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                }
              </div>

              {expandedCategory === category.id && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {catMachines.map(machine => (
                    <div 
                      key={machine.id}
                      className={`bg-white border-2 rounded-xl overflow-hidden hover:shadow-lg transition-all group ${
                        isInCompare(machine.id) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'
                      }`}
                    >
                      <div className="relative h-40 bg-gray-50">
                        {machine.image_url ? (
                          <img 
                            src={fixStorageUrl(machine.image_url)} 
                            alt={machine.name}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-12 h-12 text-gray-200" />
                          </div>
                        )}
                        
                        <div className="absolute top-2 right-2 flex flex-col gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(machine.id) }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md ${
                              isFavorite(machine.id) ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:text-red-500'
                            }`}
                            title="Favorilere Ekle"
                          >
                            <Heart className={`w-4 h-4 ${isFavorite(machine.id) ? 'fill-white' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCompare(machine) }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md ${
                              isInCompare(machine.id) ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:text-blue-500'
                            }`}
                            title="Karşılaştırmaya Ekle"
                          >
                            <Scale className="w-4 h-4" />
                          </button>
                        </div>

                        {isInCompare(machine.id) && (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                            Karşılaştırmada
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">{machine.name}</h4>
                        
                        <div className="mb-3">
                          <PriceDisplay machine={machine} size="sm" />
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" icon={Eye} onClick={() => openDetail(machine)} className="flex-1">
                            İncele
                          </Button>
                          <Button size="sm" variant="primary" icon={Send} onClick={() => requestQuote(machine)} className="flex-1">
                            Teklif İste
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Makine Detayı" size="lg">
        {selectedMachine && (
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-1/2">
                <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden">
                  {selectedMachine.image_url ? (
                    <img 
                      src={fixStorageUrl(selectedMachine.image_url)} 
                      alt={selectedMachine.name}
                      className="w-full h-full object-contain p-4"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-20 h-20 text-gray-200" />
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:w-1/2 space-y-4">
                <div>
                  <p className="text-sm text-blue-600 font-medium">{selectedMachine.category?.name}</p>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedMachine.name}</h2>
                </div>

                {selectedMachine.description && (
                  <p className="text-sm text-gray-600">{selectedMachine.description}</p>
                )}

                <div className="p-4 bg-emerald-50 rounded-xl">
                  <p className="text-sm font-medium text-emerald-800 mb-3">Kiralama Fiyatları</p>
                  <PriceDisplay machine={selectedMachine} size="md" />
                </div>

                {parseSpecs(selectedMachine.specs).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Teknik Özellikler</p>
                    <div className="grid grid-cols-2 gap-2">
                      {parseSpecs(selectedMachine.specs).map((spec, idx) => (
                        <div key={idx} className="p-2 bg-gray-50 rounded">
                          <p className="text-xs text-gray-500">{spec.key}</p>
                          <p className="text-sm font-medium text-gray-900">{spec.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evraklar - sadece yüklenenler (Kullanım Kılavuzu, Katalog, Diğer) */}
                {(selectedMachine.manual_url || selectedMachine.catalog_url || selectedMachine.other_url) && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Evraklar</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedMachine.manual_url && (
                        <a href={selectedMachine.manual_url} target="_blank" rel="noopener noreferrer" 
                           className="px-3 py-1.5 bg-gray-100 rounded text-sm text-gray-700 hover:bg-gray-200 flex items-center gap-1">
                          <FileText className="w-4 h-4" /> Kullanım Kılavuzu
                        </a>
                      )}
                      {selectedMachine.catalog_url && (
                        <a href={selectedMachine.catalog_url} target="_blank" rel="noopener noreferrer"
                           className="px-3 py-1.5 bg-gray-100 rounded text-sm text-gray-700 hover:bg-gray-200 flex items-center gap-1">
                          <FileText className="w-4 h-4" /> Katalog
                        </a>
                      )}
                      {selectedMachine.other_url && (
                        <a href={selectedMachine.other_url} target="_blank" rel="noopener noreferrer"
                           className="px-3 py-1.5 bg-gray-100 rounded text-sm text-gray-700 hover:bg-gray-200 flex items-center gap-1">
                          <FileText className="w-4 h-4" /> Diğer
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    icon={Heart}
                    onClick={() => toggleFavorite(selectedMachine.id)}
                    className={isFavorite(selectedMachine.id) ? 'text-red-500' : ''}
                  >
                    {isFavorite(selectedMachine.id) ? 'Favorilerde' : 'Favorilere Ekle'}
                  </Button>
                  <Button 
                    variant="primary" 
                    icon={Send}
                    onClick={() => { setShowDetailModal(false); requestQuote(selectedMachine) }}
                    className="flex-1"
                  >
                    Teklif İste
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Compare Modal */}
      <Modal isOpen={showCompareModal} onClose={() => setShowCompareModal(false)} title="Makine Karşılaştırma" size="xl">
        <div className="p-6 overflow-x-auto">
          {compareList.length > 0 && (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2 text-sm text-gray-500">Özellik</th>
                  {compareList.map(machine => (
                    <th key={machine.id} className="p-2 min-w-[200px]">
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto bg-gray-50 rounded-lg overflow-hidden mb-2">
                          {machine.image_url ? (
                            <img src={fixStorageUrl(machine.image_url)} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-8 h-8 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <p className="font-semibold text-sm">{machine.name}</p>
                        <button 
                          onClick={() => toggleCompare(machine)}
                          className="text-xs text-red-500 hover:underline mt-1"
                        >
                          Kaldır
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="p-2 text-sm text-gray-500">Kategori</td>
                  {compareList.map(m => (
                    <td key={m.id} className="p-2 text-center text-sm">{m.category?.name || '-'}</td>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-2 text-sm text-gray-500">Günlük Fiyat</td>
                  {compareList.map(m => (
                    <td key={m.id} className="p-2 text-center text-sm font-bold text-emerald-600">
                      {m.daily_rate ? `₺${m.daily_rate.toLocaleString('tr-TR')}` : '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-2 text-sm text-gray-500">Haftalık Fiyat</td>
                  {compareList.map(m => (
                    <td key={m.id} className="p-2 text-center text-sm font-bold text-emerald-600">
                      {m.weekly_rate ? `₺${m.weekly_rate.toLocaleString('tr-TR')}` : '-'}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-2 text-sm text-gray-500">Aylık Fiyat</td>
                  {compareList.map(m => (
                    <td key={m.id} className="p-2 text-center text-sm font-bold text-emerald-600">
                      {m.monthly_rate ? `₺${m.monthly_rate.toLocaleString('tr-TR')}` : '-'}
                    </td>
                  ))}
                </tr>
                {(() => {
                  const allSpecKeys = new Set()
                  compareList.forEach(m => {
                    parseSpecs(m.specs).forEach(s => allSpecKeys.add(s.key))
                  })
                  return Array.from(allSpecKeys).map((key, idx) => (
                    <tr key={key} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="p-2 text-sm text-gray-500">{key}</td>
                      {compareList.map(m => {
                        const spec = parseSpecs(m.specs).find(s => s.key === key)
                        return (
                          <td key={m.id} className="p-2 text-center text-sm">
                            {spec?.value || '-'}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          )}
          
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={() => setShowCompareModal(false)}>Kapat</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default MachineCatalogPage
