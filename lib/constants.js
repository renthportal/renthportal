import { Building2, MapPin, Phone, MessageSquare } from 'lucide-react'

export const LOGO_URL = 'https://renth.com.tr/storage/media/433/renth-white.svg'

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  SALES: 'SALES',
  OPERATIONS: 'OPERATIONS',
  DRIVER: 'DRIVER',
  CUSTOMER: 'CUSTOMER',
}

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Süper Yönetici',
  ADMIN: 'Yönetici',
  STAFF: 'Personel',
  SALES: 'Satış Temsilcisi',
  OPERATIONS: 'Operasyon',
  DRIVER: 'Şoför',
  CUSTOMER: 'Müşteri',
}

export const isAdminRole = (role) => role === 'ADMIN' || role === 'SUPER_ADMIN'
export const isStaffRole = (role) => role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'STAFF' || role === 'SALES' || role === 'OPERATIONS'
export const isSalesRole = (role) => role === 'SALES'
export const isOpsRole = (role) => role === 'OPERATIONS'
export const isDriverRole = (role) => role === 'DRIVER'

export const RENTAL_TYPES = [
  { value: 'DAILY', label: 'Günlük' },
  { value: 'WEEKLY', label: 'Haftalık' },
  { value: 'MONTHLY', label: 'Aylık' },
]

export const DURATION_OPTIONS = {
  DAILY: [1, 2, 3, 4, 5, 6, 7, 10, 14, 15, 20, 30],
  WEEKLY: [1, 2, 3, 4, 6, 8, 12],
  MONTHLY: [1, 2, 3, 4, 5, 6, 9, 12],
}

export const PAYMENT_TERMS = [
  { value: 'CASH', label: 'Peşin' },
  { value: 'INVOICE_7', label: 'Fatura +7 Gün' },
  { value: 'INVOICE_15', label: 'Fatura +15 Gün' },
  { value: 'INVOICE_30', label: 'Fatura +30 Gün' },
  { value: 'INVOICE_45', label: 'Fatura +45 Gün' },
  { value: 'INVOICE_60', label: 'Fatura +60 Gün' },
]

export const CURRENCIES = [
  { value: 'TRY', label: '₺ TRY' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
]

export const MACHINE_CONDITIONS = [
  'HASAR YOK', 'SEPET HASARLI', 'JOYSTICK HASARLI', 'SAĞ KAPUT HASARLI',
  'SOL KAPUT HASARLI', 'LASTİK ÖNSAĞ HASARLI', 'LASTİK ÖNSOL HASARLI',
  'LASTİK ARKASAĞ HASARLI', 'LASTİK ARKASOL HASARLI', 'AKÜ HASARI',
  'MOTOR HASARI', 'YAĞ KAÇAĞI', 'KİRLİ', 'BOYALI-HARÇLI',
]

export const ACTIVITY_TYPES = [
  { value: 'OFFICE_VISIT', label: 'Ofis Ziyareti' },
  { value: 'FIELD_VISIT', label: 'Saha Ziyareti' },
  { value: 'PHONE', label: 'Telefon' },
  { value: 'ONLINE', label: 'Online' },
]

export const ACTIVITY_TYPE_ICONS = {
  OFFICE_VISIT: Building2,
  FIELD_VISIT: MapPin,
  PHONE: Phone,
  ONLINE: MessageSquare,
}

export const ACTIVITY_TYPE_COLORS = {
  OFFICE_VISIT: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  FIELD_VISIT: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  PHONE: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  ONLINE: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
}

export const PARENT_GROUPS = [
  { id: 'all', label: 'Tümü' },
  { id: 'platforms', label: 'Platformlar', groups: ['AKÜLÜ EKLEMLİ PLATFORM','AKÜLÜ MAKASLI PLATFORM','DİZEL EKLEMLİ PLATFORM','DİZEL MAKASLI PLATFORM','DİZEL TELESKOPİK PLATFORM','DİKEY PLATFORM','ÖRÜMCEK PLATFORM','ARAÇ ÜSTÜ PLATFORM'] },
  { id: 'forklifts', label: 'Forklift & Telehandler', groups: ['FORKLİFT AKÜLÜ','FORKLİFT DİZEL','TELEHANDLER'] },
  { id: 'cranes', label: 'Vinçler', groups: ['ARAZİ TİPİ VİNÇ','ARAÇ ÜSTÜ VİNÇ','MOBİL VİNÇ'] },
  { id: 'other', label: 'Diğer', groups: ['DİĞER'] },
]

export const GROUP_CONFIG = {
  'AKÜLÜ EKLEMLİ PLATFORM': { gradient: 'from-blue-500 to-blue-700', badge: 'bg-blue-100 text-blue-700' },
  'AKÜLÜ MAKASLI PLATFORM': { gradient: 'from-cyan-500 to-cyan-700', badge: 'bg-cyan-100 text-cyan-700' },
  'DİZEL EKLEMLİ PLATFORM': { gradient: 'from-indigo-500 to-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
  'DİZEL MAKASLI PLATFORM': { gradient: 'from-violet-500 to-violet-700', badge: 'bg-violet-100 text-violet-700' },
  'DİZEL TELESKOPİK PLATFORM': { gradient: 'from-purple-500 to-purple-700', badge: 'bg-purple-100 text-purple-700' },
  'DİKEY PLATFORM': { gradient: 'from-teal-500 to-teal-700', badge: 'bg-teal-100 text-teal-700' },
  'ÖRÜMCEK PLATFORM': { gradient: 'from-pink-500 to-pink-700', badge: 'bg-pink-100 text-pink-700' },
  'ARAÇ ÜSTÜ PLATFORM': { gradient: 'from-slate-600 to-slate-800', badge: 'bg-slate-100 text-slate-700' },
  'TELEHANDLER': { gradient: 'from-amber-500 to-amber-700', badge: 'bg-amber-100 text-amber-700' },
  'FORKLİFT AKÜLÜ': { gradient: 'from-orange-400 to-orange-600', badge: 'bg-orange-100 text-orange-700' },
  'FORKLİFT DİZEL': { gradient: 'from-orange-600 to-orange-800', badge: 'bg-orange-100 text-orange-800' },
  'ARAZİ TİPİ VİNÇ': { gradient: 'from-rose-500 to-rose-700', badge: 'bg-rose-100 text-rose-700' },
  'ARAÇ ÜSTÜ VİNÇ': { gradient: 'from-red-500 to-red-700', badge: 'bg-red-100 text-red-700' },
  'MOBİL VİNÇ': { gradient: 'from-fuchsia-500 to-fuchsia-700', badge: 'bg-fuchsia-100 text-fuchsia-700' },
  'DİĞER': { gradient: 'from-gray-500 to-gray-700', badge: 'bg-gray-100 text-gray-700' },
}

export const ALL_GROUPS = Object.keys(GROUP_CONFIG)
export const extractSpec = (name, groupName) => name && groupName ? name.replace(groupName, '').trim() : ''

export const STATUS_CONFIG = {
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Teklif Bekleniyor', border: 'border-l-amber-400' },
  QUOTED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Teklif Onayı Bekleniyor', border: 'border-l-blue-500' },
  APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Onaylı', border: 'border-l-emerald-500' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Reddedildi', border: 'border-l-red-500' },
  REVISION_REQUESTED: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Revize Talebi', border: 'border-l-orange-500' },
  CONVERTED: { bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500', label: 'Sözleşmeye Dönüştü', border: 'border-l-teal-500' },
  CONTRACTED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Sözleşme', border: 'border-l-emerald-500' },
  ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Aktif', border: 'border-l-emerald-500' },
  SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Planlandı', border: 'border-l-blue-500' },
  DELIVERED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Teslim Edildi', border: 'border-l-emerald-500' },
  COMPLETED: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Tamamlandı', border: 'border-l-gray-400' },
  AVAILABLE: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Müsait', border: 'border-l-emerald-500' },
  RENTED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Kirada', border: 'border-l-blue-500' },
  MAINTENANCE: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Bakımda', border: 'border-l-amber-500' },
  RESERVED: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Rezerve', border: 'border-l-purple-500' },
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Taslak', border: 'border-l-gray-400' },
  PENDING_SIGNATURE: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'İmza Bekliyor', border: 'border-l-amber-500' },
  SIGNED_BY_CUSTOMER: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Sözleşme İmzalandı', border: 'border-l-green-500' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'İptal', border: 'border-l-red-500' },
  OPEN: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Açık', border: 'border-l-amber-500' },
  ASSIGNED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Atandı', border: 'border-l-blue-500' },
  IN_PROGRESS: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'İşlemde', border: 'border-l-purple-500' },
  RESOLVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Çözüldü', border: 'border-l-emerald-500' },
  CLOSED: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Kapatıldı', border: 'border-l-gray-400' },
  PAID: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Ödendi', border: 'border-l-emerald-500' },
  PARTIALLY_PAID: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Kısmi Ödeme', border: 'border-l-amber-500' },
  OVERDUE: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Gecikmiş', border: 'border-l-red-500' },
}

export const DELIVERY_STATUS_CONFIG = {
  UNASSIGNED: { label: 'Makine Bekliyor', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', customerLabel: 'Hazırlanıyor' },
  ASSIGNED: { label: 'Makine Atandı', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', customerLabel: 'Hazırlanıyor' },
  PLANNED: { label: 'Planlandı', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', customerLabel: 'Teslimat Planlandı' },
  IN_TRANSIT: { label: 'Yolda', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', customerLabel: 'Makine Yolda!' },
  DELIVERED: { label: 'Teslim Edildi', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', customerLabel: 'Teslim Edildi' },
}

export const RETURN_STATUS_CONFIG = {
  NONE: { label: '—', color: 'bg-gray-50 text-gray-400', dot: 'bg-gray-300', customerLabel: '—' },
  PLANNED: { label: 'İade Planlı', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', customerLabel: 'İade Planlandı' },
  IN_TRANSIT: { label: 'İade Yolda', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', customerLabel: 'İade Yolda' },
  RETURNED: { label: 'İade Edildi', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', customerLabel: 'İade Edildi' },
}

export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000
export const SESSION_WARNING_MS = 60 * 60 * 1000
export const MAX_LOGIN_ATTEMPTS = 5
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000
export const PAGE_SIZE = 10
