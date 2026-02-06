'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase, fixStorageUrl } from '@/lib/supabase'
import { 
  FileText, Upload, Download, CheckCircle, Clock, Eye, FolderKanban, 
  RefreshCw, Building, Calendar, Package, User, CreditCard, ChevronDown, ChevronUp
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import SearchBar from '@/components/ui/SearchBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCards } from '@/components/ui/Skeleton'

const ContractsPage = ({ user, showToast }) => {
  const [contracts, setContracts] = useState([])
  const [customers, setCustomers] = useState([])
  const [salesReps, setSalesReps] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [transferring, setTransferring] = useState(false)

  const isCustomer = user?.role === 'CUSTOMER'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Müşteriler
      const { data: custData } = await supabase.from('customers').select('id, company_name')
      setCustomers(custData || [])

      // Satış temsilcileri
      const { data: usersData } = await supabase.from('users').select('id, full_name')
      setSalesReps(usersData || [])

      // Teklifler
      let query = supabase.from('proposals').select('*').order('created_at', { ascending: false })

      if (isCustomer && user?.customer_id) {
        query = query.eq('customer_id', user.customer_id)
      }

      const { data, error } = await query
      if (error) throw error

      // Onaylı olanları filtrele
      const approvedStatuses = ['approved', 'APPROVED', 'contracted', 'CONTRACTED', 'signed', 'SIGNED']
      const filtered = (data || []).filter(p => approvedStatuses.includes(p.status))
      setContracts(filtered)
    } catch (err) {
      console.error('Load error:', err)
      showToast('Veriler yüklenemedi', 'error')
    }
    setLoading(false)
  }, [isCustomer, user, showToast])

  useEffect(() => { loadData() }, [loadData])

  const getCustomerName = (customerId) => customers.find(c => c.id === customerId)?.company_name || '-'
  const getSalesRepName = (repId) => salesReps.find(u => u.id === repId)?.full_name || '-'

  const parseQuoteItems = (contract) => {
    try {
      return JSON.parse(contract.quote_items || '[]')
    } catch {
      return []
    }
  }

  const getTotalAmount = (items) => {
    return items.reduce((sum, item) => sum + (parseFloat(item.rental_price) || 0) + (parseFloat(item.transport_price) || 0), 0)
  }

  const getStatusInfo = (contract) => {
    if (contract.transferred_to_rental) {
      return { label: 'Projeye Aktarıldı', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: FolderKanban }
    }
    if (contract.signed_contract_url) {
      return { label: 'Sözleşme İmzalandı', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle }
    }
    return { label: 'Sözleşme Onayı Bekleniyor', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock }
  }

  const filteredContracts = contracts.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return c.proposal_no?.toLowerCase().includes(s) || getCustomerName(c.customer_id).toLowerCase().includes(s)
  })

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedContract) return

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `contracts/signed_${selectedContract.id}_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage.from('uploads').upload(fileName, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName)

      await supabase.from('proposals').update({ 
        signed_contract_url: urlData.publicUrl,
        status: 'signed'
      }).eq('id', selectedContract.id)

      showToast('İmzalı sözleşme yüklendi', 'success')
      setShowUploadModal(false)
      loadData()
    } catch (err) {
      showToast('Yükleme başarısız: ' + err.message, 'error')
    }
    setUploading(false)
  }

  // Projeye Aktar
  const handleTransferToProject = async (contract) => {
    if (!confirm('Bu sözleşmeyi projeye aktarmak istiyor musunuz?\n\nBu işlem:\n• Proje kaydı oluşturur\n• Teslimat kalemleri oluşturur\n• Operasyon makine atayabilir hale gelir')) return
    
    setTransferring(true)
    try {
      const quoteItems = parseQuoteItems(contract)
      if (quoteItems.length === 0) {
        showToast('Sözleşmede makine kalemi bulunamadı', 'error')
        setTransferring(false)
        return
      }

      const today = new Date()
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
      const { count } = await supabase.from('rentals').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString().slice(0, 10))
      const rentalNo = `RH-${dateStr}-${String((count || 0) + 1).padStart(3, '0')}`

      const totalAmount = getTotalAmount(quoteItems)
      const startDate = quoteItems[0]?.estimated_start || today.toISOString().slice(0, 10)
      let endDate = quoteItems[0]?.estimated_end
      
      if (!endDate) {
        const duration = parseInt(quoteItems[0]?.duration) || 1
        const period = quoteItems[0]?.period?.toLowerCase() || 'ay'
        const end = new Date(startDate)
        if (period.includes('gün')) end.setDate(end.getDate() + duration)
        else if (period.includes('hafta')) end.setDate(end.getDate() + duration * 7)
        else end.setMonth(end.getMonth() + duration)
        endDate = end.toISOString().slice(0, 10)
      }

      // 1. Rentals tablosuna kayıt
      const { data: rentalData, error: rentalError } = await supabase.from('rentals').insert({
        rental_no: rentalNo,
        proposal_id: contract.id,
        customer_id: contract.customer_id,
        status: 'active',
        start_date: startDate,
        end_date: endDate,
        total_amount: totalAmount,
        total_machines: quoteItems.length,
        machines_delivered: 0
      }).select().single()

      if (rentalError) throw rentalError

      // 2. Rental_machines tablosuna kayıtlar
      const machineRecords = quoteItems.map(item => ({
        rental_id: rentalData.id,
        machine_type: item.machine_type || item.name || 'Belirtilmemiş',
        quantity: parseInt(item.quantity) || 1,
        duration: parseInt(item.duration) || 1,
        period: item.period || 'Ay',
        unit_price: parseFloat(item.rental_price) || 0,
        transport_price: parseFloat(item.transport_price) || 0,
        status: 'pending'
      }))
      await supabase.from('rental_machines').insert(machineRecords)

      // 3. Delivery_items tablosuna kayıtlar (Teslimatlar için)
      const deliveryItems = quoteItems.map((item, index) => ({
        proposal_id: contract.id,
        rental_id: rentalData.id,
        company_id: contract.customer_id,
        item_index: index + 1,
        machine_type: item.machine_type || item.name || 'Belirtilmemiş',
        duration: parseInt(item.duration) || 1,
        period: item.period || 'Ay',
        rental_price: parseFloat(item.rental_price) || 0,
        transport_price: parseFloat(item.transport_price) || 0,
        estimated_start: item.estimated_start || startDate,
        estimated_end: item.estimated_end || endDate,
        delivery_status: 'UNASSIGNED',
        return_status: 'NONE'
      }))
      await supabase.from('delivery_items').insert(deliveryItems)

      // 4. Sözleşmeyi güncelle
      await supabase.from('proposals').update({ transferred_to_rental: true }).eq('id', contract.id)

      showToast(`Proje oluşturuldu: ${rentalNo}`, 'success')
      loadData()
    } catch (err) {
      console.error('Transfer error:', err)
      showToast('Aktarım başarısız: ' + err.message, 'error')
    }
    setTransferring(false)
  }

  if (loading) return <div className="p-6"><SkeletonCards count={4} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isCustomer ? 'Sözleşmelerim' : 'Sözleşmeler'}</h1>
          <p className="text-sm text-gray-500">{contracts.length} sözleşme</p>
        </div>
        <Button variant="outline" icon={RefreshCw} onClick={loadData}>Yenile</Button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Sözleşme no, firma ara..." className="max-w-md" />

      {/* Bilgi Kutusu */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2 text-sm">Sözleşme Süreci</h3>
        <div className="flex items-center gap-2 text-xs text-blue-700 flex-wrap">
          <span className="px-2 py-1 bg-white rounded border">1. Teklif Onaylandı</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded border">2. PDF İndir & İmzala</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded border">3. İmzalı Yükle</span>
          {!isCustomer && <>
            <span>→</span>
            <span className="px-2 py-1 bg-white rounded border">4. Projeye Aktar</span>
          </>}
        </div>
      </Card>

      {/* Sözleşme Listesi */}
      {filteredContracts.length === 0 ? (
        <EmptyState icon={FileText} title="Sözleşme bulunamadı" description="Onaylanmış teklif bulunmuyor." />
      ) : (
        <div className="space-y-4">
          {filteredContracts.map(contract => {
            const status = getStatusInfo(contract)
            const StatusIcon = status.icon
            const quoteItems = parseQuoteItems(contract)
            const totalAmount = getTotalAmount(quoteItems)
            const isExpanded = expandedId === contract.id
            const canTransfer = !isCustomer && contract.signed_contract_url && !contract.transferred_to_rental

            return (
              <Card key={contract.id} className="overflow-hidden">
                {/* Ana Bilgi */}
                <div className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      {/* Başlık ve Durum */}
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-bold text-gray-900">{contract.proposal_no}</h3>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {status.label}
                        </span>
                      </div>

                      {/* Detay Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-gray-500 text-xs">Firma</p>
                            <p className="font-medium text-gray-900">{getCustomerName(contract.customer_id)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-gray-500 text-xs">Satış Temsilcisi</p>
                            <p className="font-medium text-gray-900">{getSalesRepName(contract.sales_rep_id)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-gray-500 text-xs">Toplam Tutar</p>
                            <p className="font-bold text-emerald-600">₺{totalAmount.toLocaleString('tr-TR')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-gray-500 text-xs">Tarih</p>
                            <p className="font-medium text-gray-900">{new Date(contract.created_at).toLocaleDateString('tr-TR')}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Butonlar */}
                    <div className="flex flex-wrap items-center gap-2">
                      {contract.pdf_url && (
                        <Button size="sm" variant="outline" icon={Download} onClick={() => window.open(fixStorageUrl(contract.pdf_url), '_blank')}>
                          Sözleşme PDF
                        </Button>
                      )}
                      
                      {contract.signed_contract_url ? (
                        <Button size="sm" variant="outline" icon={Eye} onClick={() => window.open(fixStorageUrl(contract.signed_contract_url), '_blank')}>
                          İmzalı PDF
                        </Button>
                      ) : isCustomer ? (
                        <Button size="sm" variant="primary" icon={Upload} onClick={() => { setSelectedContract(contract); setShowUploadModal(true) }}>
                          İmzalı Yükle
                        </Button>
                      ) : (
                        <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">İmza bekleniyor</span>
                      )}

                      {canTransfer && (
                        <Button size="sm" variant="primary" icon={FolderKanban} onClick={() => handleTransferToProject(contract)} loading={transferring}>
                          Projeye Aktar
                        </Button>
                      )}

                      <button onClick={() => setExpandedId(isExpanded ? null : contract.id)} className="p-2 hover:bg-gray-100 rounded-lg">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Genişletilmiş Detay - Makine Kalemleri */}
                {isExpanded && quoteItems.length > 0 && (
                  <div className="border-t bg-gray-50 p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Makine Kalemleri ({quoteItems.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 font-medium">#</th>
                            <th className="pb-2 font-medium">Makine Türü</th>
                            <th className="pb-2 font-medium">Süre</th>
                            <th className="pb-2 font-medium text-right">Kiralama</th>
                            <th className="pb-2 font-medium text-right">Nakliye</th>
                            <th className="pb-2 font-medium text-right">Toplam</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quoteItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-100">
                              <td className="py-2 text-gray-500">{idx + 1}</td>
                              <td className="py-2 font-medium">{item.machine_type || item.name || '-'}</td>
                              <td className="py-2">{item.duration} {item.period}</td>
                              <td className="py-2 text-right">₺{(parseFloat(item.rental_price) || 0).toLocaleString('tr-TR')}</td>
                              <td className="py-2 text-right">₺{(parseFloat(item.transport_price) || 0).toLocaleString('tr-TR')}</td>
                              <td className="py-2 text-right font-semibold">₺{((parseFloat(item.rental_price) || 0) + (parseFloat(item.transport_price) || 0)).toLocaleString('tr-TR')}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold">
                            <td colSpan={5} className="pt-2 text-right">Genel Toplam:</td>
                            <td className="pt-2 text-right text-emerald-600">₺{totalAmount.toLocaleString('tr-TR')}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="İmzalı Sözleşme Yükle" size="sm">
        <div className="p-6 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Dikkat:</strong> Lütfen sözleşmeyi indirip, imzalayıp taratarak veya fotoğrafını çekerek yükleyin.
            </p>
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-red-400 transition-colors">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} className="hidden" id="contract-upload" disabled={uploading} />
            <label htmlFor="contract-upload" className="cursor-pointer">
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">{uploading ? 'Yükleniyor...' : 'PDF veya resim dosyası seçin'}</p>
              <p className="text-xs text-gray-500 mt-1">Maksimum 10MB</p>
            </label>
          </div>
          <Button variant="outline" className="w-full" onClick={() => setShowUploadModal(false)}>İptal</Button>
        </div>
      </Modal>
    </div>
  )
}

export default ContractsPage
