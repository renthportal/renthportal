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

const MessagesPage = ({ user, showToast, isAdmin }) => {
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newFirstMessage, setNewFirstMessage] = useState('')
  const messagesEndRef = useRef(null)

  const loadConversations = async () => {
    setLoading(true)
    let query = supabase.from('conversations').select('*, company:companies(name), last_message_by_user:users!conversations_last_message_by_fkey(full_name)').order('updated_at', { ascending: false })
    if (!isAdmin && user?.company_id) query = query.eq('company_id', user.company_id)
    const { data } = await query
    setConversations(data || [])
    setLoading(false)
  }

  const loadMessages = async (convId) => {
    const { data } = await supabase.from('messages').select('*, sender:users(full_name, role)').eq('conversation_id', convId).order('created_at', { ascending: true })
    setMessages(data || [])
    // Mark as read
    const readField = isAdmin ? 'admin_read' : 'customer_read'
    await supabase.from('conversations').update({ [readField]: true }).eq('id', convId)
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  useEffect(() => { loadConversations() }, [])
  useEffect(() => { if (selectedConv) loadMessages(selectedConv.id) }, [selectedConv])

  // Realtime subscription
  useEffect(() => {
    if (!selectedConv) return
    const channel = supabase.channel('messages-' + selectedConv.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` }, (payload) => {
      setMessages(prev => [...prev, payload.new])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [selectedConv])

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv) return
    setSending(true)
    try {
      await supabase.from('messages').insert({ conversation_id: selectedConv.id, sender_id: user.id, content: newMessage.trim() })
      const readField = isAdmin ? 'customer_read' : 'admin_read'
      await supabase.from('conversations').update({ last_message: newMessage.trim(), last_message_at: new Date().toISOString(), last_message_by: user.id, [readField]: false, updated_at: new Date().toISOString() }).eq('id', selectedConv.id)
      setNewMessage('')
      logAudit(user.id, user.full_name, 'MESSAGE_SENT', { conversation_id: selectedConv.id })
    } catch (e) { showToast('Mesaj gönderilemedi', 'error') }
    setSending(false)
  }

  const handleNewConversation = async () => {
    if (!newSubject.trim() || !newFirstMessage.trim()) { showToast('Konu ve mesaj zorunlu', 'error'); return }
    setSending(true)
    try {
      const { data: conv } = await supabase.from('conversations').insert({ company_id: user.company_id, subject: newSubject.trim(), started_by: user.id, last_message: newFirstMessage.trim(), last_message_at: new Date().toISOString(), last_message_by: user.id, admin_read: false, customer_read: true }).select().single()
      if (conv) {
        await supabase.from('messages').insert({ conversation_id: conv.id, sender_id: user.id, content: newFirstMessage.trim() })
        setShowNewModal(false); setNewSubject(''); setNewFirstMessage('')
        loadConversations()
        setSelectedConv(conv)
      }
    } catch (e) { showToast('Mesaj oluşturulamadı', 'error') }
    setSending(false)
  }

  const isUnread = (conv) => isAdmin ? !conv.admin_read : !conv.customer_read

  if (loading) return <div className="p-6"><SkeletonTable rows={5} /></div>

  return (
    <div className="p-4 lg:p-6">
      <div className="flex gap-4 h-[calc(100vh-8rem)]">
        {/* Conversation List */}
        <div className={`${selectedConv && !isAdmin ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 flex-shrink-0`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">{conversations.length} Mesaj</p>
            {!isAdmin && <Button size="sm" variant="primary" icon={Plus} onClick={() => setShowNewModal(true)}>Yeni Mesaj</Button>}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {conversations.length === 0 ? (
              <EmptyState icon={MessageSquare} title="Mesaj yok" description={isAdmin ? 'Henüz müşteriden mesaj gelmedi.' : 'Yeni mesaj göndererek iletişime geçin.'}
                actionLabel={!isAdmin ? 'Yeni Mesaj' : null} onAction={() => setShowNewModal(true)} />
            ) : conversations.map(conv => (
              <div key={conv.id} onClick={() => setSelectedConv(conv)}
                className={`p-3 rounded-xl cursor-pointer transition-colors ${selectedConv?.id === conv.id ? 'bg-[#C41E3A]/10 border border-[#C41E3A]/20' : isUnread(conv) ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50 border border-transparent'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-sm font-semibold truncate ${isUnread(conv) ? 'text-gray-900' : 'text-gray-700'}`}>{conv.subject}</p>
                  {isUnread(conv) && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0" />}
                </div>
                {isAdmin && <p className="text-xs text-gray-500">{conv.company?.name}</p>}
                <p className="text-xs text-gray-400 truncate mt-1">{conv.last_message}</p>
                <p className="text-[10px] text-gray-400 mt-1">{conv.last_message_at ? new Date(conv.last_message_at).toLocaleString('tr-TR') : ''}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Message Thread */}
        <div className={`${!selectedConv ? 'hidden lg:flex' : 'flex'} flex-col flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden`}>
          {selectedConv ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <button onClick={() => setSelectedConv(null)} className="lg:hidden p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-5 h-5" /></button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{selectedConv.subject}</p>
                  {isAdmin && <p className="text-xs text-gray-500">{selectedConv.company?.name}</p>}
                </div>
              </div>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => {
                  const isMine = msg.sender_id === user.id
                  const isAdminMsg = isStaffRole(msg.sender?.role)
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? 'bg-[#C41E3A] text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'}`}>
                        {!isMine && <p className={`text-xs font-semibold mb-1 ${isAdminMsg ? 'text-[#C41E3A]' : 'text-gray-500'}`}>{msg.sender?.full_name} {isAdminMsg ? '(Renth)' : ''}</p>}
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-gray-400'}`}>{new Date(msg.created_at).toLocaleString('tr-TR')}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
              {/* Input */}
              <div className="p-3 border-t border-gray-100">
                <div className="flex gap-2">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Mesajınızı yazın..."
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} />
                  <Button variant="primary" icon={Send} onClick={handleSend} loading={sending} disabled={!newMessage.trim()} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center"><MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 text-sm">Bir mesaj seçin</p></div>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Yeni Mesaj" size="md">
        <div className="p-6 space-y-4">
          <Input label="Konu *" icon={MessageSquare} value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Örn: Teklif hakkında soru" />
          <Textarea label="Mesajınız *" rows={4} value={newFirstMessage} onChange={e => setNewFirstMessage(e.target.value)} placeholder="Mesajınızı yazın..." />
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowNewModal(false)}>İptal</Button>
          <Button variant="primary" icon={Send} loading={sending} onClick={handleNewConversation}>Gönder</Button>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SURVEY / SATISFACTION PAGE
// ═══════════════════════════════════════════════════════════════════════════



export default MessagesPage
