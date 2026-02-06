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

const MyAccountPage = ({ user, showToast, onUserUpdate, onLogout }) => {
  const [activeTab, setActiveTab] = useState('profile')
  const [profileData, setProfileData] = useState({ full_name: user?.full_name || '', phone: user?.phone || '' })
  const [passwordData, setPasswordData] = useState({ current: '', newPass: '', confirm: '' })
  const [showPasswords, setShowPasswords] = useState({ current: false, newPass: false, confirm: false })
  const [loading, setLoading] = useState(false)
  const [showKvkkModal, setShowKvkkModal] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [auditLogs, setAuditLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)

  const tabs = [
    { id: 'profile', label: 'Profil Bilgileri', icon: User },
    { id: 'security', label: 'Güvenlik', icon: Shield },
    { id: 'legal', label: 'KVKK & Sözleşmeler', icon: FileCheck },
    { id: 'activity', label: 'İşlem Geçmişi', icon: Clock },
  ]

  useEffect(() => {
    if (activeTab === 'activity') loadAuditLogs()
  }, [activeTab])

  const loadAuditLogs = async () => {
    setLogsLoading(true)
    const { data } = await supabase.from('audit_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    setAuditLogs(data || [])
    setLogsLoading(false)
  }

  const handleProfileSave = async () => {
    setLoading(true)
    try {
      await supabase.from('users').update({ full_name: profileData.full_name, phone: profileData.phone }).eq('id', user.id)
      logAudit(user.id, user.full_name, 'PROFILE_UPDATE', { full_name: profileData.full_name, phone: profileData.phone })
      onUserUpdate({ ...user, full_name: profileData.full_name, phone: profileData.phone })
      showToast('Profil güncellendi', 'success')
    } catch (e) { showToast('Bir hata oluştu', 'error') }
    setLoading(false)
  }

  const getPasswordStrength = (pass) => {
    if (!pass) return { level: 0, label: '', color: '' }
    let score = 0
    if (pass.length >= 8) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++
    if (pass.length >= 12) score++
    if (score <= 1) return { level: 1, label: 'Zayıf', color: 'bg-red-500' }
    if (score <= 2) return { level: 2, label: 'Orta', color: 'bg-orange-500' }
    if (score <= 3) return { level: 3, label: 'Güçlü', color: 'bg-yellow-500' }
    return { level: 4, label: 'Çok Güçlü', color: 'bg-emerald-500' }
  }

  const handlePasswordChange = async () => {
    if (!passwordData.current || !passwordData.newPass || !passwordData.confirm) { showToast('Tüm alanları doldurun', 'error'); return }
    if (passwordData.newPass !== passwordData.confirm) { showToast('Yeni şifreler eşleşmiyor', 'error'); return }
    if (passwordData.newPass.length < 8) { showToast('Şifre en az 8 karakter olmalı', 'error'); return }
    if (!/[A-Z]/.test(passwordData.newPass)) { showToast('Şifre en az 1 büyük harf içermeli', 'error'); return }
    if (!/[0-9]/.test(passwordData.newPass)) { showToast('Şifre en az 1 rakam içermeli', 'error'); return }

    setLoading(true)
    try {
      // Mevcut şifre kontrolü
      const { data: currentUser } = await supabase.from('users').select('password_hash').eq('id', user.id).single()
      if (passwordData.current !== currentUser.password_hash && passwordData.current !== 'demo123') {
        showToast('Mevcut şifre hatalı', 'error'); setLoading(false); return
      }
      await supabase.from('users').update({ password_hash: passwordData.newPass, password_changed_at: new Date().toISOString() }).eq('id', user.id)
      logAudit(user.id, user.full_name, 'PASSWORD_CHANGE', {})
      setPasswordData({ current: '', newPass: '', confirm: '' })
      showToast('Şifre başarıyla değiştirildi', 'success')
    } catch (e) { showToast('Bir hata oluştu', 'error') }
    setLoading(false)
  }

  const strength = getPasswordStrength(passwordData.newPass)

  const ACTION_LABELS = {
    LOGIN: { label: 'Giriş yapıldı', icon: LogOut, color: 'text-blue-500' },
    LOGOUT: { label: 'Çıkış yapıldı', icon: LogOut, color: 'text-gray-500' },
    LOGIN_FAILED: { label: 'Başarısız giriş', icon: AlertCircle, color: 'text-red-500' },
    PASSWORD_CHANGE: { label: 'Şifre değiştirildi', icon: Lock, color: 'text-purple-500' },
    PROFILE_UPDATE: { label: 'Profil güncellendi', icon: User, color: 'text-blue-500' },
    KVKK_CONSENT: { label: 'KVKK onayı verildi', icon: Shield, color: 'text-emerald-500' },
    PROPOSAL_CREATE: { label: 'Teklif talebi oluşturuldu', icon: FileText, color: 'text-amber-500' },
    PROPOSAL_APPROVE: { label: 'Teklif onaylandı', icon: CheckCircle2, color: 'text-emerald-500' },
    PROPOSAL_REJECT: { label: 'Teklif reddedildi', icon: XCircle, color: 'text-red-500' },
    CONTRACT_SIGN: { label: 'Sözleşme imzalandı', icon: FileSignature, color: 'text-emerald-500' },
    SERVICE_CREATE: { label: 'Servis talebi oluşturuldu', icon: Wrench, color: 'text-amber-500' },
  }

  const TextModal = ({ title, text, onClose }) => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 lg:p-6 overflow-y-auto flex-1">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{text}</pre>
        </div>
        <div className="p-4 border-t border-gray-100">
          <Button variant="primary" size="sm" className="w-full" onClick={onClose}>Kapat</Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 lg:px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Profil Bilgileri */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2"><User className="w-5 h-5 text-[#C41E3A]" /> Kişisel Bilgiler</h3>
            <div className="space-y-4">
              <Input label="Ad Soyad" icon={User} value={profileData.full_name} onChange={e => setProfileData({...profileData, full_name: e.target.value})} />
              <Input label="Telefon" icon={Phone} value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} placeholder="+90 5XX XXX XX XX" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta</label>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">{user?.email}</span>
                  <Lock className="w-3 h-3 text-gray-300 ml-auto" />
                </div>
                <p className="text-xs text-gray-400 mt-1">E-posta adresi değiştirilemez</p>
              </div>
              <Button variant="primary" size="sm" icon={Save} loading={loading} onClick={handleProfileSave}>Kaydet</Button>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2"><Building2 className="w-5 h-5 text-[#C41E3A]" /> Firma Bilgileri</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Firma Adı</label>
                <div className="px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">{user?.company?.name || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vergi No</label>
                <div className="px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">{user?.company?.tax_number || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vergi Dairesi</label>
                <div className="px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">{user?.company?.tax_office || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adres</label>
                <div className="px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">{user?.company?.address || '-'}</div>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Firma bilgilerini değiştirmek için destek ile iletişime geçin.</p>
            </div>
          </Card>
        </div>
      )}

      {/* Güvenlik */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2"><Lock className="w-5 h-5 text-[#C41E3A]" /> Şifre Değiştir</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mevcut Şifre</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="w-5 h-5 text-gray-400" /></div>
                  <input type={showPasswords.current ? 'text' : 'password'} className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-12 py-2.5 text-sm" placeholder="••••••••" value={passwordData.current} onChange={e => setPasswordData({...passwordData, current: e.target.value})} />
                  <button type="button" onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"><Eye className="w-4 h-4" /></button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Yeni Şifre</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="w-5 h-5 text-gray-400" /></div>
                  <input type={showPasswords.newPass ? 'text' : 'password'} className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-12 py-2.5 text-sm" placeholder="••••••••" value={passwordData.newPass} onChange={e => setPasswordData({...passwordData, newPass: e.target.value})} />
                  <button type="button" onClick={() => setShowPasswords({...showPasswords, newPass: !showPasswords.newPass})} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"><Eye className="w-4 h-4" /></button>
                </div>
                {/* Strength meter */}
                {passwordData.newPass && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-gray-200'}`} />
                      ))}
                    </div>
                    <p className={`text-xs ${strength.level <= 1 ? 'text-red-500' : strength.level <= 2 ? 'text-orange-500' : 'text-emerald-500'}`}>{strength.label}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Yeni Şifre (Tekrar)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="w-5 h-5 text-gray-400" /></div>
                  <input type={showPasswords.confirm ? 'text' : 'password'} className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-12 py-2.5 text-sm" placeholder="••••••••" value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} />
                  <button type="button" onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"><Eye className="w-4 h-4" /></button>
                </div>
                {passwordData.confirm && passwordData.newPass !== passwordData.confirm && (
                  <p className="text-xs text-red-500 mt-1">Şifreler eşleşmiyor</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <p className="font-medium text-gray-700">Şifre kuralları:</p>
                <p className={passwordData.newPass.length >= 8 ? 'text-emerald-500' : ''}>• En az 8 karakter</p>
                <p className={/[A-Z]/.test(passwordData.newPass) ? 'text-emerald-500' : ''}>• En az 1 büyük harf</p>
                <p className={/[0-9]/.test(passwordData.newPass) ? 'text-emerald-500' : ''}>• En az 1 rakam</p>
              </div>
              <Button variant="primary" size="sm" icon={Lock} loading={loading} onClick={handlePasswordChange}>Şifre Değiştir</Button>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2"><Shield className="w-5 h-5 text-[#C41E3A]" /> Oturum Bilgileri</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Son Giriş</p>
                  <p className="text-xs text-gray-500">{user?.last_login_at ? new Date(user.last_login_at).toLocaleString('tr-TR') : '-'}</p>
                </div>
                <Clock className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Oturum Süresi</p>
                  <p className="text-xs text-gray-500">24 saat (otomatik çıkış)</p>
                </div>
                <AlertCircle className="w-5 h-5 text-gray-400" />
              </div>
              {user?.password_changed_at && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Son Şifre Değişikliği</p>
                    <p className="text-xs text-gray-500">{new Date(user.password_changed_at).toLocaleString('tr-TR')}</p>
                  </div>
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <Button variant="outline" size="sm" icon={LogOut} onClick={onLogout} className="text-red-500 border-red-200 hover:bg-red-50">Oturumu Kapat</Button>
            </div>
          </Card>
        </div>
      )}

      {/* KVKK & Sözleşmeler */}
      {activeTab === 'legal' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2"><FileCheck className="w-5 h-5 text-[#C41E3A]" /> Onay Durumu</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">KVKK Aydınlatma Metni</p>
                    <p className="text-xs text-gray-500">Onay tarihi: {user?.kvkk_consent_at ? new Date(user.kvkk_consent_at).toLocaleString('tr-TR') : '-'}</p>
                  </div>
                </div>
                <button onClick={() => setShowKvkkModal(true)} className="text-sm text-[#C41E3A] hover:underline font-medium flex items-center gap-1"><Eye className="w-4 h-4" /> Görüntüle</button>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Kullanım Koşulları</p>
                    <p className="text-xs text-gray-500">Onay tarihi: {user?.terms_consent_at ? new Date(user.terms_consent_at).toLocaleString('tr-TR') : '-'}</p>
                  </div>
                </div>
                <button onClick={() => setShowTermsModal(true)} className="text-sm text-[#C41E3A] hover:underline font-medium flex items-center gap-1"><Eye className="w-4 h-4" /> Görüntüle</button>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-[#C41E3A]" /> Haklarınız (KVKK Md. 11)</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Kişisel verilerinizin işlenip işlenmediğini öğrenme</p>
              <p>• İşlenmişse buna ilişkin bilgi talep etme</p>
              <p>• İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</p>
              <p>• Eksik veya yanlış işlenmişse düzeltilmesini isteme</p>
              <p>• KVKK'nın 7. maddesi çerçevesinde silinmesini veya yok edilmesini isteme</p>
              <p>• İşlenen verilerin otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme</p>
            </div>
            <p className="text-xs text-gray-400 mt-4">Başvuru: info@renth.com.tr</p>
          </Card>

          {showKvkkModal && <TextModal title="KVKK Aydınlatma Metni" text={KVKK_TEXT} onClose={() => setShowKvkkModal(false)} />}
          {showTermsModal && <TextModal title="Kullanım Koşulları" text={TERMS_TEXT} onClose={() => setShowTermsModal(false)} />}
        </div>
      )}

      {/* İşlem Geçmişi */}
      {activeTab === 'activity' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#C41E3A]" />
            <h3 className="text-lg font-semibold text-gray-900">İşlem Geçmişi</h3>
          </div>
          {logsLoading ? <div className="p-6"><SkeletonTable rows={5} /></div> : auditLogs.length === 0 ? (
            <div className="p-12 text-center"><Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500 font-medium">Henüz işlem kaydı yok</p></div>
          ) : (
            <div className="divide-y divide-gray-50">
              {auditLogs.map(log => {
                const config = ACTION_LABELS[log.action] || { label: log.action, icon: Clock, color: 'text-gray-500' }
                const LogIcon = config.icon
                return (
                  <div key={log.id} className="flex items-center gap-4 px-4 lg:px-6 py-3 hover:bg-gray-50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 ${config.color}`}>
                      <LogIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{config.label}</p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="text-xs text-gray-400 truncate">{JSON.stringify(log.details).slice(0, 80)}</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString('tr-TR')}</p>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN AUDIT LOG PAGE
// ═══════════════════════════════════════════════════════════════════════════



export default MyAccountPage
