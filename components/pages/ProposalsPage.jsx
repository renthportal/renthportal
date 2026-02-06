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
import { generateProposalPDF } from '@/lib/pdf'
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

const ProposalsPage = ({ user, showToast, isAdmin, setActivePage }) => {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showNewProposalModal, setShowNewProposalModal] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState(null)
  const [quoteItems, setQuoteItems] = useState([])
  const [quoteForm, setQuoteForm] = useState({ valid_until: '', currency: 'TRY', payment_term: 'CASH' })
  const [rejectReason, setRejectReason] = useState('')
  const [approveFile, setApproveFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' })
  const [page, setPage] = useState(1)
  const [companiesList, setCompaniesList] = useState([])
  const [newProposalForm, setNewProposalForm] = useState({ company_id: '', valid_until: '', currency: 'TRY', payment_term: 'CASH', notes: '', delivery_city: '', delivery_district: '', delivery_address_detail: '' })
  const [citiesList, setCitiesList] = useState([])
  const [districtsList, setDistrictsList] = useState([])
  const [newProposalItems, setNewProposalItems] = useState([{ machine_type: '', duration: 1, period: 'Ay', rental_price: 0, rental_discount: 0, transport_price: 0, transport_discount: 0, estimated_start: '', estimated_end: '', item_notes: '' }])
  const [machineTypesList, setMachineTypesList] = useState([])
  const [salesReps, setSalesReps] = useState([])

  const loadData = async () => {
    setLoading(true)
    let query = supabase.from('proposals').select(`*, company:companies(id, name)`).order('created_at', { ascending: false })
    if (!isAdmin && user?.company_id) query = query.eq('company_id', user.company_id)
    const { data } = await query
    setProposals(data || [])
    // Load companies + machines for staff new proposal
    if (isAdmin) {
      const [compRes, machRes, citiesRes, usersRes] = await Promise.all([
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('machines').select('name').order('name'),
        supabase.from('cities').select('*').order('name'),
        supabase.from('users').select('id, full_name')
      ])
      setCompaniesList(compRes.data || [])
      setMachineTypesList([...new Set((machRes.data || []).map(m => m.name))])
      setCitiesList(citiesRes.data || [])
      setSalesReps(usersRes.data || [])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { setPage(1) }, [search, statusFilter, dateFilter])

  // Load districts when city changes in new proposal form
  useEffect(() => {
    const loadDistricts = async () => {
      if (!newProposalForm.delivery_city) { setDistrictsList([]); return }
      const city = citiesList.find(c => c.name === newProposalForm.delivery_city)
      if (city) { const { data } = await supabase.from('districts').select('*').eq('city_id', city.id).order('name'); setDistrictsList(data || []) }
    }
    loadDistricts()
  }, [newProposalForm.delivery_city, citiesList])

  const filteredProposals = proposals.filter(p => {
    const matchesSearch = !search || p.proposal_number?.toLowerCase().includes(search.toLowerCase()) || p.company?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || p.status === statusFilter
    const matchesDateFrom = !dateFilter.from || new Date(p.created_at) >= new Date(dateFilter.from)
    const matchesDateTo = !dateFilter.to || new Date(p.created_at) <= new Date(dateFilter.to + 'T23:59:59')
    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
  })

  const parseItemsFromNotes = (notes) => {
    if (!notes) return []
    const items = []; const lines = notes.split('\n'); let inSection = false
    for (const line of lines) {
      if (line.includes('Makineler:')) { inSection = true; continue }
      if (line.includes('Teslimat Adresi:') || line.includes('Genel Notlar:')) { inSection = false; continue }
      if (inSection && line.trim()) {
        const match = line.match(/^\d+\.\s*(.+?)\s*-\s*(\d+)\s*(Gün|Hafta|Ay)/i)
        if (match) items.push({ machine_type: match[1].trim(), duration: parseInt(match[2]), period: match[3], rental_price: 0, rental_discount: 0, transport_price: 0, transport_discount: 0, estimated_start: '', estimated_end: '', item_notes: '' })
      }
    }
    return items
  }

  const parseAddressFromNotes = (notes) => {
    if (!notes) return ''
    const match = notes.match(/Teslimat Adresi:\n([^\n]+(?:\n[^\n]+)?)/i)
    return match ? match[1].trim() : ''
  }

  const openQuoteModal = (proposal) => {
    const items = parseItemsFromNotes(proposal.notes)
    if (proposal.quote_items) { try { const saved = JSON.parse(proposal.quote_items); items.forEach((item, i) => { if (saved[i]) { item.rental_price = saved[i].rental_price || 0; item.rental_discount = saved[i].rental_discount || 0; item.transport_price = saved[i].transport_price || 0; item.transport_discount = saved[i].transport_discount || 0; item.estimated_start = saved[i].estimated_start || ''; item.estimated_end = saved[i].estimated_end || ''; item.item_notes = saved[i].item_notes || '' } }) } catch {} }
    setQuoteItems(items)
    setQuoteForm({ valid_until: proposal.valid_until ? proposal.valid_until.split('T')[0] : new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], currency: proposal.currency || 'TRY', payment_term: proposal.payment_term || 'CASH' })
    setSelectedProposal(proposal); setShowQuoteModal(true)
  }

  const handleSendQuote = async () => {
    if (!quoteForm.valid_until) { showToast('Geçerlilik tarihi seçin', 'error'); return }
    if (quoteItems.some(i => !i.machine_type?.trim())) { showToast('Makine adı girin', 'error'); return }
    if (quoteItems.some(i => !i.rental_price)) { showToast('Fiyat girin', 'error'); return }
    try {
      const totalAmount = quoteItems.reduce((s, i) => s + ((i.rental_price || 0) - (i.rental_discount || 0)) * (i.duration || 1) + ((i.transport_price || 0) - (i.transport_discount || 0)), 0)
      const totalOriginal = quoteItems.reduce((s, i) => s + (i.rental_price || 0) * (i.duration || 1) + (i.transport_price || 0), 0)
      await supabase.from('proposals').update({ status: 'QUOTED', quote_items: JSON.stringify(quoteItems), total_amount: totalAmount, total_original: totalOriginal, currency: quoteForm.currency, payment_term: quoteForm.payment_term, valid_until: quoteForm.valid_until }).eq('id', selectedProposal.id)
      showToast('Teklif gönderildi', 'success'); setShowQuoteModal(false); loadData()
      // Auto-generate PDF
      try {
        const { data: compData } = await supabase.from('companies').select('*').eq('id', selectedProposal.company_id).single()
        const { data: repData } = selectedProposal.user_id ? await supabase.from('users').select('full_name, phone, email').eq('id', selectedProposal.user_id).single() : { data: null }
        generateProposalPDF({ ...selectedProposal, currency: quoteForm.currency, payment_term: quoteForm.payment_term, valid_until: quoteForm.valid_until, total_amount: totalAmount }, quoteItems, compData, repData || user)
      } catch(pdfErr) { console.warn('PDF generation error:', pdfErr) }
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
  }

  const handleApprove = async () => {
    if (!approveFile) { showToast('Lütfen imzalı sözleşme PDF\'ini yükleyin', 'error'); return }
    setUploading(true)
    try {
      // 1. Upload signed PDF
      const ext = approveFile.name.split('.').pop()
      const fileName = `contracts/signed_${selectedProposal.id}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('uploads').upload(fileName, approveFile, { contentType: approveFile.type })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName)

      // 2. Update proposal status to CONVERTED
      await supabase.from('proposals').update({ 
        status: 'CONVERTED', 
        approved_at: new Date().toISOString(),
        signed_pdf_url: urlData.publicUrl
      }).eq('id', selectedProposal.id)

      // 3. Auto-create delivery_items from quote_items
      const quoteItems = selectedProposal.quote_items ? JSON.parse(selectedProposal.quote_items) : []
      if (quoteItems.length > 0) {
        const today = new Date().toISOString().slice(0, 10)

        const deliveryItemsData = quoteItems.map((item, index) => ({
          proposal_id: selectedProposal.id,
          company_id: selectedProposal.company_id,
          item_index: index + 1,
          machine_type: item.machine_type || 'Belirtilmemiş',
          duration: parseInt(item.duration) || 1,
          period: item.period || 'Ay',
          rental_price: parseFloat(item.rental_price) || 0,
          transport_price: parseFloat(item.transport_price) || 0,
          estimated_start: item.estimated_start || today,
          estimated_end: item.estimated_end || null,
          delivery_status: 'UNASSIGNED',
          return_status: 'NONE'
        }))
        const { error: diError } = await supabase.from('delivery_items').insert(deliveryItemsData)
        if (diError) throw diError

        // Mark proposal as transferred
        await supabase.from('proposals').update({ transferred_to_rental: true }).eq('id', selectedProposal.id)
      }

      showToast('Teklif onaylandı ve proje oluşturuldu!', 'success')
      setShowApproveModal(false)
      loadData()
    } catch (err) { 
      showToast('Hata: ' + err.message, 'error') 
    }
    setUploading(false)
  }

  const handleRejectWithReason = async () => {
    if (!rejectReason.trim()) { showToast('Red sebebi yazın', 'error'); return }
    try {
      await supabase.from('proposals').update({ status: 'REJECTED', rejection_reason: rejectReason, rejected_at: new Date().toISOString() }).eq('id', selectedProposal.id)
      showToast('Teklif reddedildi', 'success'); setShowRejectModal(false); setRejectReason(''); loadData()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
  }

  // Sales revise on rejected proposal — reopens quote modal, saves back to QUOTED
  const handleRevise = (proposal) => {
    openQuoteModal(proposal)
  }

  const openNewProposalModal = () => {
    setNewProposalForm({ company_id: '', valid_until: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], currency: 'TRY', payment_term: 'CASH', notes: '', delivery_city: '', delivery_district: '', delivery_address_detail: '' })
    setNewProposalItems([{ machine_type: '', duration: 1, period: 'Ay', rental_price: 0, rental_discount: 0, transport_price: 0, transport_discount: 0, estimated_start: '', estimated_end: '', item_notes: '' }])
    setShowNewProposalModal(true)
  }

  const handleCreateNewProposal = async () => {
    if (!newProposalForm.company_id) { showToast('Firma seçin', 'error'); return }
    if (!newProposalForm.valid_until) { showToast('Geçerlilik tarihi seçin', 'error'); return }
    if (!newProposalForm.delivery_city) { showToast('Teslimat ili seçin', 'error'); return }
    if (newProposalItems.some(i => !i.machine_type?.trim())) { showToast('Makine adı girin', 'error'); return }
    if (newProposalItems.some(i => !i.rental_price)) { showToast('Fiyat girin', 'error'); return }
    try {
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const { data: todayProposals } = await supabase.from('proposals').select('proposal_number').like('proposal_number', `RH-${dateStr}-%`).order('proposal_number', { ascending: false }).limit(1)
      let seqNum = 1
      if (todayProposals?.length > 0) seqNum = parseInt(todayProposals[0].proposal_number.split('-').pop(), 10) + 1
      const proposalNumber = `RH-${dateStr}-${String(seqNum).padStart(3, '0')}`
      const totalAmount = newProposalItems.reduce((s, i) => s + ((i.rental_price || 0) - (i.rental_discount || 0)) * (i.duration || 1) + ((i.transport_price || 0) - (i.transport_discount || 0)), 0)
      const totalOriginal = newProposalItems.reduce((s, i) => s + (i.rental_price || 0) * (i.duration || 1) + (i.transport_price || 0), 0)
      const itemsText = newProposalItems.map((item, i) => {
        let line = `${i + 1}. ${item.machine_type} - ${item.duration} ${item.period}`
        if (item.estimated_start) line += ` | Başlangıç: ${item.estimated_start}`
        if (item.estimated_end) line += ` | Bitiş: ${item.estimated_end}`
        if (item.item_notes) line += `\n   Not: ${item.item_notes}`
        return line
      }).join('\n')

      const deliveryAddr = newProposalForm.delivery_city ? `${newProposalForm.delivery_city}${newProposalForm.delivery_district ? ' / ' + newProposalForm.delivery_district : ''}\n${newProposalForm.delivery_address_detail || ''}` : ''
      await supabase.from('proposals').insert([{
        proposal_number: proposalNumber,
        company_id: newProposalForm.company_id,
        user_id: user.id,
        status: 'QUOTED',
        notes: `[SATIŞ TEKLİFİ]\n\nMakineler:\n${itemsText}\n\nTeslimat Adresi:\n${deliveryAddr || '-'}\n\n${newProposalForm.notes ? 'Genel Notlar:\n' + newProposalForm.notes : ''}\n\nKiralama Temsilcisi: ${user.full_name}`,
        quote_items: JSON.stringify(newProposalItems),
        total_amount: totalAmount,
        total_original: totalOriginal,
        currency: newProposalForm.currency,
        payment_term: newProposalForm.payment_term,
        valid_until: newProposalForm.valid_until,
      }])

      logAudit(user.id, user.full_name, 'PROPOSAL_CREATED', { proposal_number: proposalNumber, company_id: newProposalForm.company_id, total: totalAmount, original: totalOriginal })
      showToast('Teklif oluşturuldu ve müşteriye gönderildi', 'success')
      // Auto-generate PDF
      try {
        const { data: compData } = await supabase.from('companies').select('*').eq('id', newProposalForm.company_id).single()
        generateProposalPDF({ proposal_number: proposalNumber, currency: newProposalForm.currency, payment_term: newProposalForm.payment_term, valid_until: newProposalForm.valid_until, total_amount: totalAmount, notes: `Makineler:\n${itemsText}\n\nTeslimat Adresi:\n${deliveryAddr || '-'}\n\n${newProposalForm.notes ? 'Genel Notlar:\n' + newProposalForm.notes : ''}`, company: { name: compData?.name } }, newProposalItems, compData, user)
      } catch(pdfErr) { console.warn('PDF generation error:', pdfErr) }
      setShowNewProposalModal(false); loadData()
    } catch (err) { showToast('Hata: ' + err.message, 'error') }
  }

  const getCurrencySymbol = (c) => c === 'USD' ? '$' : c === 'EUR' ? '€' : '₺'
  const getPaymentTermLabel = (t) => PAYMENT_TERMS.find(p => p.value === t)?.label || t

  const statusFilterOptions = [
    { value: '', label: 'Tüm Durumlar' },
    { value: 'PENDING', label: 'Teklif Bekleniyor' },
    { value: 'QUOTED', label: 'Teklif Onayı Bekleniyor' },
    { value: 'REJECTED', label: 'Reddedildi' },
    { value: 'CONVERTED', label: 'Sözleşmeye Dönüştü' },
  ]

  if (loading) return <div className="p-6 space-y-6"><SkeletonStats count={3} />{[1,2,3].map(i => <SkeletonPulse key={i} className="w-full h-32 rounded-2xl" />)}</div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-4">
        {isAdmin && <Button variant="primary" size="sm" icon={Plus} onClick={openNewProposalModal}>Yeni Teklif Oluştur</Button>}
        {!isAdmin && <Button variant="primary" size="sm" icon={Plus} onClick={() => setActivePage && setActivePage('request')}>Yeni Teklif Talebi</Button>}
      </div>

      {/* Enhanced Filter Bar */}
      <Card className="p-3 lg:p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <SearchBar value={search} onChange={setSearch} placeholder="Teklif no, firma ara..." className="flex-1" />
          <Select options={statusFilterOptions} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full sm:w-44" />
          <div className="flex gap-2 items-center">
            <input type="date" value={dateFilter.from} onChange={e => setDateFilter({...dateFilter, from: e.target.value})} className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-full sm:w-auto" placeholder="Başlangıç" />
            <span className="text-gray-400 hidden sm:inline">-</span>
            <input type="date" value={dateFilter.to} onChange={e => setDateFilter({...dateFilter, to: e.target.value})} className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-full sm:w-auto" placeholder="Bitiş" />
          </div>
          {(statusFilter || dateFilter.from || dateFilter.to) && (
            <button onClick={() => { setStatusFilter(''); setDateFilter({ from: '', to: '' }) }} className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap flex items-center gap-1"><X className="w-4 h-4" /> Temizle</button>
          )}
        </div>
      </Card>

      {/* Proposal Cards with Visual Hierarchy */}
      <div className="grid gap-4">
        {paginate(filteredProposals, page).map(proposal => {
          const items = parseItemsFromNotes(proposal.notes)
          const address = parseAddressFromNotes(proposal.notes)
          const borderClass = STATUS_CONFIG[proposal.status]?.border || 'border-l-gray-300'
          const isActionNeeded = (!isAdmin && proposal.status === 'QUOTED') || (isAdmin && (proposal.status === 'PENDING' || proposal.status === 'REJECTED'))

          return (
            <Card key={proposal.id} className={`overflow-hidden border-l-4 ${borderClass} ${isActionNeeded ? 'ring-1 ring-blue-200 shadow-md' : ''}`}>
              {isActionNeeded && <div className="bg-blue-50 px-4 py-1.5 text-xs font-medium text-blue-700 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Aksiyon gerekli</div>}
              <div className="p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-bold text-base lg:text-lg text-gray-900">{proposal.proposal_number}</h3>
                      <StatusBadge status={proposal.status} size="sm" />
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-3 mb-2 text-sm">
                        <span className="text-gray-600">{proposal.company?.name}</span>
                        {proposal.user_id && <span className="text-blue-600 flex items-center gap-1"><User className="w-3.5 h-3.5" />{salesReps.find(u => u.id === proposal.user_id)?.full_name || '-'}</span>}
                      </div>
                    )}
                    <div className="mt-2 space-y-1">
                      {items.slice(0, 3).map((item, i) => (
                        <div key={i} className="text-sm text-gray-600 flex items-center gap-2"><Package className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="truncate">{item.machine_type} - {item.duration} {item.period}</span></div>
                      ))}
                      {items.length > 3 && <p className="text-xs text-gray-400">+{items.length - 3} makine daha</p>}
                    </div>
                    {address && <div className="mt-2 text-sm text-gray-500 flex items-center gap-1"><MapPin className="w-4 h-4 flex-shrink-0" /><span className="truncate">{address}</span></div>}
                    <div className="mt-3 flex items-center gap-3 flex-wrap text-sm">
                      {proposal.total_amount > 0 && <span className="font-bold text-[#C41E3A]">{getCurrencySymbol(proposal.currency)}{proposal.total_amount?.toLocaleString()}</span>}
                      <span className="text-gray-400">{new Date(proposal.created_at).toLocaleDateString('tr-TR')}</span>
                      {proposal.payment_term && <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded text-xs">{getPaymentTermLabel(proposal.payment_term)}</span>}
                    </div>
                    {/* Red sebebi göster */}
                    {proposal.status === 'REJECTED' && proposal.rejection_reason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-xs font-medium text-red-800">Red Sebebi:</p><p className="text-sm text-red-700">{proposal.rejection_reason}</p></div>
                    )}
                    {/* Sözleşme badge + İmzalı PDF */}
                    {(proposal.status === 'CONTRACTED' || proposal.status === 'CONVERTED') && (
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-700">Sözleşmeye dönüştürüldü - Proje oluşturuldu</p>
                          </div>
                          {proposal.signed_pdf_url && (
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(fixStorageUrl(proposal.signed_pdf_url), '_blank') }}
                              className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1 flex-shrink-0"
                            >
                              <Download className="w-3 h-3" />İmzalı Sözleşme
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-row lg:flex-col gap-2 flex-shrink-0">
                    <Button size="sm" variant="ghost" icon={Eye} onClick={() => { setSelectedProposal(proposal); setShowDetailModal(true) }}>Detay</Button>
                    {/* Staff: Fiyat Ver (PENDING) */}
                    {isAdmin && proposal.status === 'PENDING' && <Button size="sm" variant="primary" onClick={() => openQuoteModal(proposal)}>Fiyat Ver</Button>}
                    {/* Staff: Revize Ver (REJECTED) */}
                    {isAdmin && proposal.status === 'REJECTED' && <Button size="sm" variant="primary" onClick={() => handleRevise(proposal)}>Revize Ver</Button>}
                    {/* Customer: Onayla + Reddet (QUOTED) */}
                    {!isAdmin && proposal.status === 'QUOTED' && (
                      <>
                        <Button size="sm" variant="success" onClick={() => { setSelectedProposal(proposal); setApproveFile(null); setShowApproveModal(true) }}>Onayla</Button>
                        <Button size="sm" variant="danger" onClick={() => { setSelectedProposal(proposal); setRejectReason(''); setShowRejectModal(true) }}>Reddet</Button>
                      </>
                    )}
                    {/* PDF İndir (QUOTED, CONTRACTED) */}
                    
                    {/* Teklif PDF Oluştur */}
                    {['QUOTED', 'CONTRACTED', 'CONVERTED'].includes(proposal.status) && proposal.quote_items && (
                      <Button size="sm" variant="outline" icon={FileText} onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          const qi = JSON.parse(proposal.quote_items || '[]')
                          const { data: compData } = await supabase.from('companies').select('*').eq('id', proposal.company_id).single()
                          const { data: repData } = proposal.user_id ? await supabase.from('users').select('full_name, phone, email').eq('id', proposal.user_id).single() : { data: null }
                          generateProposalPDF(proposal, qi, compData, repData || user)
                        } catch(err) { showToast('PDF oluşturulamadı: ' + err.message, 'error') }
                      }}>Teklif PDF</Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Pagination total={filteredProposals.length} page={page} setPage={setPage} />

      {filteredProposals.length === 0 && !loading && (
        <EmptyState icon={FileText} title={search || statusFilter ? 'Sonuç bulunamadı' : 'Teklif yok'}
          description={search || statusFilter ? 'Filtreleri değiştirmeyi deneyin.' : 'Henüz teklif bulunmuyor.'}
          onboardingStep={!isAdmin && !search ? '💡 İpucu: Makineler sayfasından veya Teklif Talebi menüsünden yeni talep oluşturabilirsiniz.' : null}
          action={!isAdmin && !search ? <Button variant="primary" icon={Plus} onClick={() => setActivePage && setActivePage('request')}>İlk Teklif Talebinizi Oluşturun</Button> : null}
        />
      )}

      {/* Quote Modal (Admin) */}
      <Modal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} title="Fiyat Teklifi Ver" size="xl">
        {selectedProposal && (
          <div className="p-4 lg:p-6 space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="font-semibold text-gray-900">{selectedProposal.company?.name}</p>
              <p className="text-sm text-gray-500">{selectedProposal.proposal_number}</p>
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-2 block">Müşteri Talebi</label><div className="bg-blue-50 p-4 rounded-xl text-sm text-gray-700 whitespace-pre-wrap border border-blue-100 max-h-40 overflow-y-auto">{selectedProposal.notes || 'Talep detayı yok'}</div></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Geçerlilik Tarihi *" type="date" value={quoteForm.valid_until} onChange={e => setQuoteForm({...quoteForm, valid_until: e.target.value})} />
              <Select label="Para Birimi *" value={quoteForm.currency} onChange={e => setQuoteForm({...quoteForm, currency: e.target.value})} options={CURRENCIES} />
              <Select label="Ödeme Vadesi *" value={quoteForm.payment_term} onChange={e => setQuoteForm({...quoteForm, payment_term: e.target.value})} options={PAYMENT_TERMS} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-gray-700">Teklif Kalemleri</label>
                <Button size="sm" variant="outline" icon={Plus} onClick={() => setQuoteItems([...quoteItems, { machine_type: '', duration: 1, period: 'Ay', rental_price: 0, rental_discount: 0, transport_price: 0, transport_discount: 0, estimated_start: '', estimated_end: '', item_notes: '' }])}>Kalem Ekle</Button>
              </div>
              {quoteItems.map((item, index) => {
                const rentalNet = (item.rental_price || 0) - (item.rental_discount || 0)
                const transportNet = (item.transport_price || 0) - (item.transport_discount || 0)
                const itemOriginal = (item.rental_price || 0) * (item.duration || 1) + (item.transport_price || 0)
                const itemDiscounted = rentalNet * (item.duration || 1) + transportNet
                const hasDiscount = (item.rental_discount || 0) > 0 || (item.transport_discount || 0) > 0
                const sym = getCurrencySymbol(quoteForm.currency)
                return (
                <div key={index} className="p-4 bg-gray-50 rounded-xl mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-gray-700 text-sm">Kalem #{index + 1}</span>
                    <button onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div><SearchableSelect label="Makine/Hizmet *" value={item.machine_type || ''} onChange={val => { const n = [...quoteItems]; n[index].machine_type = val; setQuoteItems(n) }} options={machineTypesList} placeholder="Makine seçin..." searchPlaceholder="Makine ara..." allowCustom={true} customLabel="Diğer (elle girin)" /></div>
                    <Input label="Süre *" type="number" min="1" value={item.duration || 1} onChange={e => { const n = [...quoteItems]; n[index].duration = parseInt(e.target.value) || 1; setQuoteItems(n) }} />
                    <Select label="Periyod *" value={item.period || 'Ay'} onChange={e => { const n = [...quoteItems]; n[index].period = e.target.value; setQuoteItems(n) }} options={[{ value: 'Gün', label: 'Gün' }, { value: 'Hafta', label: 'Hafta' }, { value: 'Ay', label: 'Ay' }]} />
                  </div>
                  {/* Birim Kiralama Tutarı + İndirim */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                    <Input label={`Birim Kiralama Tutarı (${sym}) *`} type="number" value={item.rental_price || ''} onChange={e => { const n = [...quoteItems]; n[index].rental_price = parseFloat(e.target.value) || 0; setQuoteItems(n) }} />
                    <Input label={`Kiralama İndirimi (${sym})`} type="number" value={item.rental_discount || ''} onChange={e => { const n = [...quoteItems]; n[index].rental_discount = parseFloat(e.target.value) || 0; setQuoteItems(n) }} />
                    <div><label className="block text-sm font-medium text-gray-700 mb-1.5">İndirimli Birim Kiralama Tutarı</label><div className={`px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold ${rentalNet < (item.rental_price || 0) ? 'bg-green-50 text-green-700' : 'bg-white text-gray-900'}`}>{sym}{rentalNet.toLocaleString()}</div></div>
                    <div />
                  </div>
                  {/* Nakliye Tutarı + İndirim */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                    <Input label={`Nakliye Tutarı (${sym})`} type="number" value={item.transport_price || ''} onChange={e => { const n = [...quoteItems]; n[index].transport_price = parseFloat(e.target.value) || 0; setQuoteItems(n) }} />
                    <Input label={`Nakliye İndirimi (${sym})`} type="number" value={item.transport_discount || ''} onChange={e => { const n = [...quoteItems]; n[index].transport_discount = parseFloat(e.target.value) || 0; setQuoteItems(n) }} />
                    <div><label className="block text-sm font-medium text-gray-700 mb-1.5">İndirimli Nakliye Tutarı</label><div className={`px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold ${transportNet < (item.transport_price || 0) ? 'bg-green-50 text-green-700' : 'bg-white text-gray-900'}`}>{sym}{transportNet.toLocaleString()}</div></div>
                    <div />
                  </div>
                  {/* Tahmini Tarihler */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <Input label="Tahmini Başlangıç" type="date" value={item.estimated_start || ''} onChange={e => { const n = [...quoteItems]; n[index].estimated_start = e.target.value; setQuoteItems(n) }} />
                    <Input label="Tahmini Bitiş" type="date" value={item.estimated_end || ''} onChange={e => { const n = [...quoteItems]; n[index].estimated_end = e.target.value; setQuoteItems(n) }} />
                  </div>
                  {/* Kalem Notu */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Not</label>
                    <textarea rows={2} value={item.item_notes || ''} onChange={e => { const n = [...quoteItems]; n[index].item_notes = e.target.value; setQuoteItems(n) }} placeholder="Bu kalem için not..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent" />
                  </div>
                  {/* Kalem Toplamları */}
                  <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {hasDiscount && <span className="line-through text-gray-400 mr-2">{sym}{itemOriginal.toLocaleString()}</span>}
                      <span className="font-bold text-gray-900">{sym}{itemDiscounted.toLocaleString()}</span>
                    </div>
                    {hasDiscount && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">%{((1 - itemDiscounted / (itemOriginal || 1)) * 100).toFixed(0)} indirim {(item.rental_discount || 0) > 0 && (item.transport_discount || 0) > 0 ? '(Kira+Nakliye)' : (item.rental_discount || 0) > 0 ? '(Kiralama)' : '(Nakliye)'}</span>}
                  </div>
                </div>
              )})}
            </div>
            {/* Toplamlar */}
            {(() => {
              const grandOriginal = quoteItems.reduce((s, i) => s + (i.rental_price || 0) * (i.duration || 1) + (i.transport_price || 0), 0)
              const grandDiscounted = quoteItems.reduce((s, i) => s + ((i.rental_price || 0) - (i.rental_discount || 0)) * (i.duration || 1) + ((i.transport_price || 0) - (i.transport_discount || 0)), 0)
              const hasAnyDiscount = grandOriginal !== grandDiscounted
              const sym = getCurrencySymbol(quoteForm.currency)
              return (
                <div className="space-y-3">
                  {hasAnyDiscount && (
                    <div className="bg-gray-100 p-4 rounded-xl flex items-center justify-between">
                      <span className="text-sm text-gray-500">Liste Toplamı</span>
                      <span className="text-lg font-semibold text-gray-400 line-through">{sym}{grandOriginal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className={`p-4 rounded-xl flex items-center justify-between ${hasAnyDiscount ? 'bg-green-50 border-2 border-green-200' : 'bg-[#C41E3A]/10'}`}>
                    <span className="text-sm font-medium text-gray-700">{hasAnyDiscount ? '🎯 Firmanıza Özel İndirimli Toplam' : 'Genel Toplam'}</span>
                    <span className={`text-2xl font-bold ${hasAnyDiscount ? 'text-green-700' : 'text-[#C41E3A]'}`}>{sym}{grandDiscounted.toLocaleString()}</span>
                  </div>
                  {hasAnyDiscount && (
                    <p className="text-center text-xs text-green-600 font-medium">Toplam {sym}{(grandOriginal - grandDiscounted).toLocaleString()} indirim (%{((1 - grandDiscounted / (grandOriginal || 1)) * 100).toFixed(1)})</p>
                  )}
                </div>
              )
            })()}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="ghost" onClick={() => setShowQuoteModal(false)}>İptal</Button>
              <Button variant="primary" icon={Send} onClick={handleSendQuote}>Teklif Gönder</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Teklif Detayı" size="lg">
        {selectedProposal && (
          <div className="p-4 lg:p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-gray-500">Teklif No</p><p className="font-semibold">{selectedProposal.proposal_number}</p></div>
              <div><p className="text-sm text-gray-500">Durum</p><StatusBadge status={selectedProposal.status} /></div>
              <div><p className="text-sm text-gray-500">Firma</p><p className="font-semibold">{selectedProposal.company?.name}</p></div>
              <div><p className="text-sm text-gray-500">Tarih</p><p className="font-semibold">{new Date(selectedProposal.created_at).toLocaleDateString('tr-TR')}</p></div>
            </div>
            <div><p className="text-sm font-medium text-gray-700 mb-2">Talep Detayları</p><div className="bg-gray-50 p-4 rounded-xl whitespace-pre-wrap text-sm text-gray-700 max-h-48 overflow-y-auto">{selectedProposal.notes?.split('\n\nKiralama Temsilcisi:')[0]}</div></div>
            {selectedProposal.notes?.includes('Kiralama Temsilcisi:') && (
              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-sm font-medium text-blue-800 mb-1">Kiralama Temsilcisi</p>
                <p className="font-semibold text-blue-900">{selectedProposal.notes.split('Kiralama Temsilcisi:')[1]?.split('\n')[0]?.trim()}</p>
              </div>
            )}
            {selectedProposal.total_amount > 0 && (
              <div><p className="text-sm font-medium text-gray-700 mb-2">Fiyat Teklifi</p>
                <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                  {selectedProposal.quote_items && JSON.parse(selectedProposal.quote_items).map((item, i) => {
                    const rentalNet = (item.rental_price || 0) - (item.rental_discount || 0)
                    const transportNet = (item.transport_price || 0) - (item.transport_discount || 0)
                    const itemOriginal = (item.rental_price || 0) * (item.duration || 1) + (item.transport_price || 0)
                    const itemDiscounted = rentalNet * (item.duration || 1) + transportNet
                    const hasDiscount = (item.rental_discount || 0) > 0 || (item.transport_discount || 0) > 0
                    const sym = getCurrencySymbol(selectedProposal.currency)
                    return (
                    <div key={i} className="border-b pb-3 last:border-b-0 last:pb-0">
                      <p className="font-semibold text-gray-800 mb-2">{item.machine_type}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-gray-500">Süre:</span><span className="text-right">{item.duration} {item.period}</span>
                        <span className="text-gray-500">Birim Kiralama Tutarı:</span><span className="text-right font-medium">{sym}{Number(item.rental_price).toLocaleString()}</span>
                        {(item.rental_discount || 0) > 0 && <><span className="text-green-600">Kiralama İndirimi:</span><span className="text-right text-green-600">-{sym}{Number(item.rental_discount).toLocaleString()}</span></>}
                        {(item.rental_discount || 0) > 0 && <><span className="text-green-700 font-medium">İndirimli Birim Kiralama Tutarı:</span><span className="text-right text-green-700 font-medium">{sym}{rentalNet.toLocaleString()}</span></>}
                        <span className="text-gray-500">Nakliye Tutarı:</span><span className="text-right">{sym}{Number(item.transport_price || 0).toLocaleString()}</span>
                        {(item.transport_discount || 0) > 0 && <><span className="text-green-600">Nakliye İndirimi:</span><span className="text-right text-green-600">-{sym}{Number(item.transport_discount).toLocaleString()}</span></>}
                        {(item.transport_discount || 0) > 0 && <><span className="text-green-700 font-medium">İndirimli Nakliye Tutarı:</span><span className="text-right text-green-700 font-medium">{sym}{transportNet.toLocaleString()}</span></>}
                        {item.estimated_start && <><span className="text-gray-500">Tahmini Başlangıç:</span><span className="text-right">{new Date(item.estimated_start).toLocaleDateString('tr-TR')}</span></>}
                        {item.estimated_end && <><span className="text-gray-500">Tahmini Bitiş:</span><span className="text-right">{new Date(item.estimated_end).toLocaleDateString('tr-TR')}</span></>}
                        {hasDiscount ? (
                          <><span className="text-gray-500 font-semibold">Ara Toplam:</span><span className="text-right font-semibold"><span className="line-through text-gray-400 mr-1">{sym}{itemOriginal.toLocaleString()}</span> <span className="text-green-700">{sym}{itemDiscounted.toLocaleString()}</span></span></>
                        ) : (
                          <><span className="text-gray-500 font-semibold">Ara Toplam:</span><span className="text-right font-semibold">{sym}{itemOriginal.toLocaleString()}</span></>
                        )}
                      </div>
                      {item.item_notes && <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg p-2 text-xs text-amber-800">📝 {item.item_notes}</div>}
                    </div>
                  )})}
                  {(() => {
                    const items = JSON.parse(selectedProposal.quote_items || '[]')
                    const grandOriginal = items.reduce((s, i) => s + (i.rental_price || 0) * (i.duration || 1) + (i.transport_price || 0), 0)
                    const grandDiscounted = items.reduce((s, i) => s + ((i.rental_price || 0) - (i.rental_discount || 0)) * (i.duration || 1) + ((i.transport_price || 0) - (i.transport_discount || 0)), 0)
                    const hasAnyDiscount = grandOriginal !== grandDiscounted
                    const sym = getCurrencySymbol(selectedProposal.currency)
                    return (
                      <>
                        {hasAnyDiscount && (
                          <div className="border-t pt-3 flex justify-between items-center">
                            <span className="text-gray-400">Liste Toplamı</span>
                            <span className="text-gray-400 line-through">{sym}{grandOriginal.toLocaleString()}</span>
                          </div>
                        )}
                        <div className={`${hasAnyDiscount ? '' : 'border-t'} pt-3 flex justify-between items-center`}>
                          <span className="font-semibold">{hasAnyDiscount ? '🎯 İndirimli Toplam' : 'Genel Toplam'}</span>
                          <span className={`font-bold text-lg ${hasAnyDiscount ? 'text-green-700' : 'text-[#C41E3A]'}`}>{sym}{grandDiscounted.toLocaleString()}</span>
                        </div>
                        {hasAnyDiscount && <p className="text-xs text-green-600 text-center">Toplam {sym}{(grandOriginal - grandDiscounted).toLocaleString()} tasarruf (%{((1 - grandDiscounted / (grandOriginal || 1)) * 100).toFixed(1)})</p>}
                      </>
                    )
                  })()}
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>Ödeme: {getPaymentTermLabel(selectedProposal.payment_term)}</span>
                    {selectedProposal.valid_until && <span>Geçerlilik: {new Date(selectedProposal.valid_until).toLocaleDateString('tr-TR')}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject Modal (Müşteri) */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Teklifi Reddet" size="md">
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700">Reddettiğinizde satış ekibimiz teklifinizi revize edip yeni bir teklif sunabilir.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Red Sebebi *</label>
            <Textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Teklifi neden reddettiğinizi yazın... (Fiyat yüksek, süre uymuyor, farklı makine istiyorum vb.)" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowRejectModal(false)}>İptal</Button>
            <Button variant="danger" onClick={handleRejectWithReason}>Reddet</Button>
          </div>
        </div>
      </Modal>

      {/* Approve Modal (Müşteri - PDF İndir & İmzalı Yükle) */}
      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} title="Teklif Onayı & Sözleşme" size="md">
        <div className="p-6 space-y-4">
          {selectedProposal && (
            <>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="font-semibold text-gray-900">{selectedProposal.proposal_number}</p>
                <p className="text-sm text-gray-500">Toplam: {getCurrencySymbol(selectedProposal.currency)}{selectedProposal.total_amount?.toLocaleString()}</p>
              </div>

              {/* Adım 1: Teklif PDF İndir */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">1. Adım: Teklif PDF'ini İndirin</p>
                <p className="text-xs text-blue-700 mb-3">Teklif PDF'ini indirip, inceleyip, imzalayarak tekrar yükleyin.</p>
                {selectedProposal.quote_items && (
                  <Button size="sm" variant="outline" icon={Download} onClick={async () => {
                    try {
                      const qi = JSON.parse(selectedProposal.quote_items || '[]')
                      const { data: compData } = await supabase.from('companies').select('*').eq('id', selectedProposal.company_id).single()
                      const { data: repData } = selectedProposal.user_id ? await supabase.from('users').select('full_name, phone, email').eq('id', selectedProposal.user_id).single() : { data: null }
                      generateProposalPDF(selectedProposal, qi, compData, repData || user)
                    } catch(err) { showToast('PDF oluşturulamadı: ' + err.message, 'error') }
                  }}>Teklif PDF İndir</Button>
                )}
              </div>

              {/* Adım 2: İmzalı PDF Yükle */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-yellow-900 mb-2">2. Adım: İmzalı Sözleşmeyi Yükleyin</p>
                <p className="text-xs text-yellow-700 mb-3">İmzaladığınız PDF veya fotoğrafı yükleyin. Bu işlem teklifi onaylayacak ve projeye dönüştürecektir.</p>
                <div className="border-2 border-dashed border-yellow-300 rounded-lg p-4 text-center hover:border-yellow-500 transition-colors">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setApproveFile(e.target.files?.[0] || null)} className="hidden" id="approve-upload" />
                  <label htmlFor="approve-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-yellow-800">{approveFile ? approveFile.name : 'İmzalı dosya seçin'}</p>
                    <p className="text-xs text-yellow-600 mt-1">PDF, JPG veya PNG</p>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowApproveModal(false)}>İptal</Button>
                <Button variant="success" loading={uploading} onClick={handleApprove} disabled={!approveFile}>Sözleşmeyi Onayla</Button>
              </div>
            </>
          )}
        </div>
      </Modal>


      {/* New Proposal Modal (Staff Direct) */}
      <Modal isOpen={showNewProposalModal} onClose={() => setShowNewProposalModal(false)} title="Yeni Teklif Oluştur" size="xl">
        <div className="p-4 lg:p-6 space-y-6">
          {/* Company Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Firma *</label>
            <select value={newProposalForm.company_id} onChange={e => setNewProposalForm({...newProposalForm, company_id: e.target.value})} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent">
              <option value="">Firma seçin...</option>
              {companiesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Quote Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Geçerlilik Tarihi *" type="date" value={newProposalForm.valid_until} onChange={e => setNewProposalForm({...newProposalForm, valid_until: e.target.value})} />
            <Select label="Para Birimi *" value={newProposalForm.currency} onChange={e => setNewProposalForm({...newProposalForm, currency: e.target.value})} options={CURRENCIES} />
            <Select label="Ödeme Vadesi *" value={newProposalForm.payment_term} onChange={e => setNewProposalForm({...newProposalForm, payment_term: e.target.value})} options={PAYMENT_TERMS} />
          </div>

          {/* Quote Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-700">Teklif Kalemleri</label>
              <Button size="sm" variant="outline" icon={Plus} onClick={() => setNewProposalItems([...newProposalItems, { machine_type: '', duration: 1, period: 'Ay', rental_price: 0, rental_discount: 0, transport_price: 0, transport_discount: 0, estimated_start: '', estimated_end: '', item_notes: '' }])}>Kalem Ekle</Button>
            </div>
            {newProposalItems.map((item, index) => {
              const rentalNet = (item.rental_price || 0) - (item.rental_discount || 0)
              const transportNet = (item.transport_price || 0) - (item.transport_discount || 0)
              const itemOriginal = (item.rental_price || 0) * (item.duration || 1) + (item.transport_price || 0)
              const itemDiscounted = rentalNet * (item.duration || 1) + transportNet
              const hasDiscount = (item.rental_discount || 0) > 0 || (item.transport_discount || 0) > 0
              const sym = getCurrencySymbol(newProposalForm.currency)
              return (
              <div key={index} className="p-4 bg-gray-50 rounded-xl mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-700 text-sm">Kalem #{index + 1}</span>
                  {newProposalItems.length > 1 && <button onClick={() => setNewProposalItems(newProposalItems.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div><SearchableSelect label="Makine/Hizmet *" value={item.machine_type || ''} onChange={val => { const n = [...newProposalItems]; n[index].machine_type = val; setNewProposalItems(n) }} options={machineTypesList} placeholder="Makine seçin..." searchPlaceholder="Makine ara..." /></div>
                  <Input label="Süre *" type="number" min="1" value={item.duration || 1} onChange={e => { const n = [...newProposalItems]; n[index].duration = parseInt(e.target.value) || 1; setNewProposalItems(n) }} />
                  <Select label="Periyod *" value={item.period || 'Ay'} onChange={e => { const n = [...newProposalItems]; n[index].period = e.target.value; setNewProposalItems(n) }} options={[{ value: 'Gün', label: 'Gün' }, { value: 'Hafta', label: 'Hafta' }, { value: 'Ay', label: 'Ay' }]} />
                </div>
                {/* Birim Kiralama Tutarı + İndirim */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                  <Input label={`Birim Kiralama Tutarı (${sym}) *`} type="number" value={item.rental_price || ''} onChange={e => { const n = [...newProposalItems]; n[index].rental_price = parseFloat(e.target.value) || 0; setNewProposalItems(n) }} />
                  <Input label={`Kiralama İndirimi (${sym})`} type="number" value={item.rental_discount || ''} onChange={e => { const n = [...newProposalItems]; n[index].rental_discount = parseFloat(e.target.value) || 0; setNewProposalItems(n) }} />
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">İndirimli Birim Kiralama Tutarı</label><div className={`px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold ${rentalNet < (item.rental_price || 0) ? 'bg-green-50 text-green-700' : 'bg-white text-gray-900'}`}>{sym}{rentalNet.toLocaleString()}</div></div>
                  <div />
                </div>
                {/* Nakliye Tutarı + İndirim */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                  <Input label={`Nakliye Tutarı (${sym})`} type="number" value={item.transport_price || ''} onChange={e => { const n = [...newProposalItems]; n[index].transport_price = parseFloat(e.target.value) || 0; setNewProposalItems(n) }} />
                  <Input label={`Nakliye İndirimi (${sym})`} type="number" value={item.transport_discount || ''} onChange={e => { const n = [...newProposalItems]; n[index].transport_discount = parseFloat(e.target.value) || 0; setNewProposalItems(n) }} />
                  <div><label className="block text-sm font-medium text-gray-700 mb-1.5">İndirimli Nakliye Tutarı</label><div className={`px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold ${transportNet < (item.transport_price || 0) ? 'bg-green-50 text-green-700' : 'bg-white text-gray-900'}`}>{sym}{transportNet.toLocaleString()}</div></div>
                  <div />
                </div>
                {/* Tahmini Tarihler */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <Input label="Tahmini Başlangıç" type="date" value={item.estimated_start || ''} onChange={e => { const n = [...newProposalItems]; n[index].estimated_start = e.target.value; setNewProposalItems(n) }} />
                  <Input label="Tahmini Bitiş" type="date" value={item.estimated_end || ''} onChange={e => { const n = [...newProposalItems]; n[index].estimated_end = e.target.value; setNewProposalItems(n) }} />
                </div>
                {/* Kalem Notu */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Not</label>
                  <textarea rows={2} value={item.item_notes || ''} onChange={e => { const n = [...newProposalItems]; n[index].item_notes = e.target.value; setNewProposalItems(n) }} placeholder="Bu kalem için not..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent" />
                </div>
                {/* Kalem Toplamı */}
                <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {hasDiscount && <span className="line-through text-gray-400 mr-2">{sym}{itemOriginal.toLocaleString()}</span>}
                    <span className="font-bold text-gray-900">{sym}{itemDiscounted.toLocaleString()}</span>
                  </div>
                  {hasDiscount && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">%{((1 - itemDiscounted / (itemOriginal || 1)) * 100).toFixed(0)} indirim {(item.rental_discount || 0) > 0 && (item.transport_discount || 0) > 0 ? '(Kira+Nakliye)' : (item.rental_discount || 0) > 0 ? '(Kiralama)' : '(Nakliye)'}</span>}
                </div>
              </div>
            )})}
          </div>

          {/* Toplamlar */}
          {(() => {
            const grandOriginal = newProposalItems.reduce((s, i) => s + (i.rental_price || 0) * (i.duration || 1) + (i.transport_price || 0), 0)
            const grandDiscounted = newProposalItems.reduce((s, i) => s + ((i.rental_price || 0) - (i.rental_discount || 0)) * (i.duration || 1) + ((i.transport_price || 0) - (i.transport_discount || 0)), 0)
            const hasAnyDiscount = grandOriginal !== grandDiscounted
            const sym = getCurrencySymbol(newProposalForm.currency)
            return (
              <div className="space-y-3">
                {hasAnyDiscount && (
                  <div className="bg-gray-100 p-4 rounded-xl flex items-center justify-between">
                    <span className="text-sm text-gray-500">Liste Toplamı</span>
                    <span className="text-lg font-semibold text-gray-400 line-through">{sym}{grandOriginal.toLocaleString()}</span>
                  </div>
                )}
                <div className={`p-4 rounded-xl flex items-center justify-between ${hasAnyDiscount ? 'bg-green-50 border-2 border-green-200' : 'bg-[#C41E3A]/10'}`}>
                  <span className="text-sm font-medium text-gray-700">{hasAnyDiscount ? '🎯 Firmanıza Özel İndirimli Toplam' : 'Genel Toplam'}</span>
                  <span className={`text-2xl font-bold ${hasAnyDiscount ? 'text-green-700' : 'text-[#C41E3A]'}`}>{sym}{grandDiscounted.toLocaleString()}</span>
                </div>
                {hasAnyDiscount && (
                  <p className="text-center text-xs text-green-600 font-medium">Toplam {sym}{(grandOriginal - grandDiscounted).toLocaleString()} indirim (%{((1 - grandDiscounted / (grandOriginal || 1)) * 100).toFixed(1)})</p>
                )}
              </div>
            )
          })()}

          {/* Teslimat Adresi */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#C41E3A]" />Teslimat Adresi</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">İl *</label>
                <select value={newProposalForm.delivery_city} onChange={e => setNewProposalForm({...newProposalForm, delivery_city: e.target.value, delivery_district: ''})} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent">
                  <option value="">İl seçin...</option>
                  {citiesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">İlçe</label>
                <select value={newProposalForm.delivery_district} onChange={e => setNewProposalForm({...newProposalForm, delivery_district: e.target.value})} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent" disabled={!newProposalForm.delivery_city}>
                  <option value="">İlçe seçin...</option>
                  {districtsList.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Adres Detayı</label>
              <textarea value={newProposalForm.delivery_address_detail} onChange={e => setNewProposalForm({...newProposalForm, delivery_address_detail: e.target.value})} rows={2} placeholder="Şantiye adı, mahalle, sokak vb." className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent" />
            </div>
          </div>

          {/* Notes */}
          <Textarea label="Notlar (opsiyonel)" rows={3} value={newProposalForm.notes} onChange={e => setNewProposalForm({...newProposalForm, notes: e.target.value})} placeholder="Özel şartlar vb..." />

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">Teklif doğrudan "Onay Bekliyor" durumunda müşterinin portalına düşecek. Müşteri onaylayabilir, revize isteyebilir veya reddedebilir.</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setShowNewProposalModal(false)}>İptal</Button>
            <Button variant="primary" icon={Send} onClick={handleCreateNewProposal}>Teklif Gönder</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACTS PAGE
// ═══════════════════════════════════════════════════════════════════════════



export default ProposalsPage
