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

const SurveyPage = ({ user, showToast, isAdmin }) => {
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSurveyModal, setShowSurveyModal] = useState(false)
  const [selectedSurvey, setSelectedSurvey] = useState(null)
  const [ratings, setRatings] = useState({ overall: 0, machine_quality: 0, delivery: 0, support: 0 })
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    let query = supabase.from('surveys').select('*, rental:rentals(*, machine:machines(name, brand), company:companies(name))').order('created_at', { ascending: false })
    if (!isAdmin && user?.company_id) query = query.eq('company_id', user.company_id)
    const { data } = await query
    setSurveys(data || [])

    // If customer, check for pending surveys (completed rentals without survey)
    if (!isAdmin && user?.company_id) {
      const { data: completedRentals } = await supabase.from('rentals').select('*, machine:machines(name, brand)').eq('company_id', user.company_id).eq('status', 'COMPLETED')
      const surveyedRentalIds = (data || []).map(s => s.rental_id)
      const pending = (completedRentals || []).filter(r => !surveyedRentalIds.includes(r.id))
      if (pending.length > 0 && !showSurveyModal) {
        // Show first pending survey automatically
        setSelectedSurvey(pending[0])
        setShowSurveyModal(true)
      }
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSubmit = async () => {
    if (ratings.overall === 0) { showToast('Lütfen genel puanlama yapın', 'error'); return }
    setSubmitting(true)
    try {
      await supabase.from('surveys').insert({
        rental_id: selectedSurvey.id,
        company_id: user.company_id,
        user_id: user.id,
        overall_rating: ratings.overall,
        machine_quality_rating: ratings.machine_quality,
        delivery_rating: ratings.delivery,
        support_rating: ratings.support,
        comment: comment.trim(),
      })
      logAudit(user.id, user.full_name, 'SURVEY_SUBMIT', { rental_id: selectedSurvey.id, overall: ratings.overall })
      showToast('Değerlendirmeniz kaydedildi. Teşekkürler!', 'success')
      setShowSurveyModal(false)
      setRatings({ overall: 0, machine_quality: 0, delivery: 0, support: 0 })
      setComment('')
      loadData()
    } catch (e) { showToast('Bir hata oluştu', 'error') }
    setSubmitting(false)
  }

  const StarRating = ({ value, onChange, label }) => (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} type="button" onClick={() => onChange(star)} className="transition-transform hover:scale-110">
            <Star className={`w-7 h-7 ${star <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
          </button>
        ))}
        {value > 0 && <span className="text-sm text-gray-500 ml-2 self-center">{value}/5</span>}
      </div>
    </div>
  )

  const avgRating = (survey) => {
    const vals = [survey.overall_rating, survey.machine_quality_rating, survey.delivery_rating, survey.support_rating].filter(Boolean)
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '-'
  }

  if (loading) return <div className="p-6"><SkeletonTable rows={5} /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Admin Stats */}
      {isAdmin && surveys.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Star} label="Ortalama Puan" value={(surveys.reduce((s, sv) => s + sv.overall_rating, 0) / surveys.length).toFixed(1)} variant="primary" />
          <StatCard icon={CheckCircle2} label="Toplam Anket" value={surveys.length} variant="success" />
          <StatCard icon={TrendingUp} label="Makine Kalitesi" value={(surveys.reduce((s, sv) => s + (sv.machine_quality_rating || 0), 0) / surveys.filter(s => s.machine_quality_rating).length || 0).toFixed(1)} variant="navy" />
          <StatCard icon={Truck} label="Teslimat" value={(surveys.reduce((s, sv) => s + (sv.delivery_rating || 0), 0) / surveys.filter(s => s.delivery_rating).length || 0).toFixed(1)} />
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Değerlendirmeler</h3>
        </div>
        {surveys.length === 0 ? (
          <EmptyState icon={Star} title="Değerlendirme yok" description={isAdmin ? 'Henüz müşteri değerlendirmesi yapılmadı.' : 'Kiralama tamamlandığında değerlendirme yapabilirsiniz.'} />
        ) : (
          <div className="divide-y divide-gray-50">
            {surveys.map(survey => (
              <div key={survey.id} className="p-4 lg:p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm text-gray-900">{survey.rental?.machine?.name || 'Makine'}</p>
                      {isAdmin && <span className="text-xs text-gray-500">— {survey.rental?.company?.name}</span>}
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= survey.overall_rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />)}
                      <span className="text-sm font-medium text-gray-700 ml-1">{avgRating(survey)}</span>
                    </div>
                    {survey.comment && <p className="text-sm text-gray-600">{survey.comment}</p>}
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      {survey.machine_quality_rating > 0 && <span>Makine: {survey.machine_quality_rating}/5</span>}
                      {survey.delivery_rating > 0 && <span>Teslimat: {survey.delivery_rating}/5</span>}
                      {survey.support_rating > 0 && <span>Destek: {survey.support_rating}/5</span>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap">{new Date(survey.created_at).toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Survey Modal */}
      <Modal isOpen={showSurveyModal} onClose={() => setShowSurveyModal(false)} title="Kiralama Değerlendirmesi" size="md">
        {selectedSurvey && (
          <div className="p-6 space-y-6">
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#C41E3A] rounded-lg flex items-center justify-center"><Package className="w-5 h-5 text-white" /></div>
              <div>
                <p className="font-semibold text-sm">{selectedSurvey.machine?.name}</p>
                <p className="text-xs text-gray-500">{selectedSurvey.machine?.brand}</p>
              </div>
            </div>

            <StarRating label="Genel Memnuniyet *" value={ratings.overall} onChange={v => setRatings({...ratings, overall: v})} />
            <StarRating label="Makine Kalitesi" value={ratings.machine_quality} onChange={v => setRatings({...ratings, machine_quality: v})} />
            <StarRating label="Teslimat & Lojistik" value={ratings.delivery} onChange={v => setRatings({...ratings, delivery: v})} />
            <StarRating label="Destek & İletişim" value={ratings.support} onChange={v => setRatings({...ratings, support: v})} />

            <Textarea label="Yorumunuz" rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Deneyiminizi paylaşın... (opsiyonel)" />
          </div>
        )}
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowSurveyModal(false)}>Daha Sonra</Button>
          <Button variant="primary" icon={Send} loading={submitting} onClick={handleSubmit}>Gönder</Button>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST QUOTE PAGE
// ═══════════════════════════════════════════════════════════════════════════



export default SurveyPage
