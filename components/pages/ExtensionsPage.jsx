'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock, CheckCircle2, XCircle, AlertCircle, Building2, Package, Calendar } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'

const ExtensionsPage = ({ user, showToast }) => {
  const [extensions, setExtensions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, pending, approved, rejected
  const [selectedExt, setSelectedExt] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('extensions')
        .select(`
          *,
          contract:contracts(id, contract_number, company_id),
          company:companies(id, name),
          delivery_item:delivery_items(id, machine_type, assigned_machine_serial),
          requester:users!extensions_requested_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setExtensions(data || [])
    } catch (err) {
      console.error('Load extensions error:', err)
      showToast('Uzatma talepleri yüklenemedi', 'error')
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleApprove = async (ext) => {
    if (!confirm('Uzatma talebini onaylamak istediğinize emin misiniz?')) return
    setProcessing(true)
    try {
      // Uzatmayı onayla
      const { error: extErr } = await supabase
        .from('extensions')
        .update({ 
          status: 'APPROVED', 
          approved_at: new Date().toISOString(), 
          approved_by: user.id 
        })
        .eq('id', ext.id)
      
      if (extErr) throw extErr

      // Eğer delivery_item_id varsa, o makinenin bitiş tarihini güncelle
      if (ext.delivery_item_id) {
        await supabase
          .from('delivery_items')
          .update({ return_planned_date: ext.new_end_date })
          .eq('id', ext.delivery_item_id)
      }

      showToast('Uzatma onaylandı', 'success')
      loadData()
    } catch (err) {
      console.error('Approve error:', err)
      showToast('Onaylama başarısız', 'error')
    }
    setProcessing(false)
  }

  const handleReject = async () => {
    if (!selectedExt) return
    setProcessing(true)
    try {
      const { error } = await supabase
        .from('extensions')
        .update({ 
          status: 'REJECTED',
          rejection_reason: rejectReason || null
        })
        .eq('id', selectedExt.id)
      
      if (error) throw error
      showToast('Uzatma reddedildi', 'success')
      setSelectedExt(null)
      setRejectReason('')
      loadData()
    } catch (err) {
      console.error('Reject error:', err)
      showToast('Reddetme başarısız', 'error')
    }
    setProcessing(false)
  }

  const filteredExtensions = extensions.filter(ext => {
    if (filter === 'pending') return ext.status === 'PENDING'
    if (filter === 'approved') return ext.status === 'APPROVED'
    if (filter === 'rejected') return ext.status === 'REJECTED'
    return true
  })

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-'

  const stats = {
    total: extensions.length,
    pending: extensions.filter(e => e.status === 'PENDING').length,
    approved: extensions.filter(e => e.status === 'APPROVED').length,
    rejected: extensions.filter(e => e.status === 'REJECTED').length
  }

  if (loading) return <div className="p-6"><SkeletonTable rows={5} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`p-4 cursor-pointer ${filter === 'all' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter('all')}>
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">Toplam</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 cursor-pointer ${filter === 'pending' ? 'ring-2 ring-amber-500' : ''}`} onClick={() => setFilter('pending')}>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-gray-500">Bekleyen</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 cursor-pointer ${filter === 'approved' ? 'ring-2 ring-emerald-500' : ''}`} onClick={() => setFilter('approved')}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{stats.approved}</p>
              <p className="text-xs text-gray-500">Onaylanan</p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 cursor-pointer ${filter === 'rejected' ? 'ring-2 ring-red-500' : ''}`} onClick={() => setFilter('rejected')}>
          <div className="flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.rejected}</p>
              <p className="text-xs text-gray-500">Reddedilen</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Firma / Sözleşme</th>
                <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Makine</th>
                <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Tarihler</th>
                <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Talep Eden</th>
                <th className="text-left px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Durum</th>
                <th className="text-right px-4 lg:px-6 py-3 text-xs font-semibold text-gray-500 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExtensions.map(ext => (
                <tr key={ext.id} className="hover:bg-gray-50">
                  <td className="px-4 lg:px-6 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{ext.company?.name || '-'}</p>
                        <p className="text-xs text-gray-500">{ext.contract?.contract_number || '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-900">{ext.machine_type || ext.delivery_item?.machine_type || 'Tüm makineler'}</p>
                        {ext.delivery_item?.assigned_machine_serial && (
                          <p className="text-xs text-gray-500">{ext.delivery_item.assigned_machine_serial}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">{formatDate(ext.current_end_date)}</p>
                        <p className="text-sm font-medium text-emerald-600">→ {formatDate(ext.new_end_date)}</p>
                        <p className="text-xs text-gray-400">+{ext.requested_days} gün</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-3 hidden sm:table-cell">
                    <p className="text-sm text-gray-600">{ext.requester?.full_name || '-'}</p>
                    <p className="text-xs text-gray-400">{formatDate(ext.created_at)}</p>
                  </td>
                  <td className="px-4 lg:px-6 py-3">
                    <StatusBadge status={ext.status} size="sm" />
                  </td>
                  <td className="px-4 lg:px-6 py-3 text-right">
                    {ext.status === 'PENDING' && (
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="success" onClick={() => handleApprove(ext)} loading={processing}>
                          Onayla
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setSelectedExt(ext)}>
                          Reddet
                        </Button>
                      </div>
                    )}
                    {ext.status === 'APPROVED' && ext.approved_at && (
                      <span className="text-xs text-gray-500">{formatDate(ext.approved_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredExtensions.length === 0 && (
          <EmptyState 
            icon={Clock} 
            title="Uzatma talebi yok" 
            description={filter === 'pending' ? 'Bekleyen uzatma talebi bulunmuyor.' : 'Gösterilecek uzatma talebi yok.'} 
          />
        )}
      </Card>

      {/* Reject Modal */}
      <Modal
        isOpen={!!selectedExt}
        onClose={() => { setSelectedExt(null); setRejectReason('') }}
        title="Uzatma Talebini Reddet"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>{selectedExt?.company?.name}</strong> firmasının uzatma talebini reddetmek üzeresiniz.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Red Nedeni (Opsiyonel)</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reddetme nedeninizi belirtebilirsiniz..."
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setSelectedExt(null); setRejectReason('') }}>
              İptal
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleReject} loading={processing}>
              Reddet
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ExtensionsPage
