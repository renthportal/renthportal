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
import Logo from '@/components/ui/Logo'
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

const KVKK_TEXT = `RENTH KİŞİSEL VERİLERİN İŞLENMESİNE İLİŞKİN AYDINLATMA METNİ

İşbu Aydınlatma Metni, Renth (HAREKET) ("Şirket") tarafından müşterilerinin 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında kişisel verilerinin işlenmesine ilişkin olarak bilgilendirilmesi amacıyla hazırlanmıştır.

1. Veri Sorumlusu
Veri sorumlusu Renth / HAREKET'tir.

2. İşlenen Kişisel Veriler
Kimlik bilgileri (ad, soyad), iletişim bilgileri (e-posta, telefon, adres), firma bilgileri (unvan, vergi no), işlem bilgileri (kiralama talepleri, sözleşmeler, faturalar) ve giriş bilgileri (IP adresi, oturum zamanları).

3. Kişisel Verilerin İşlenme Amaçları
- Kiralama hizmetlerinin sunulması ve yönetimi
- Teklif, sözleşme ve fatura süreçlerinin yürütülmesi
- Müşteri ilişkileri yönetimi
- Yasal yükümlülüklerin yerine getirilmesi
- Hizmet kalitesinin artırılması

4. Kişisel Verilerin Aktarılması
Kişisel verileriniz; yasal zorunluluklar kapsamında yetkili kamu kurum ve kuruluşlarına, hizmet sağlayıcılarına ve iş ortaklarına KVKK'nın 8. ve 9. maddelerinde belirtilen şartlar dahilinde aktarılabilir.

5. Kişisel Verilerin Toplanma Yöntemi ve Hukuki Sebebi
Kişisel verileriniz, elektronik ortamda (web portalı, e-posta) ve fiziki ortamda toplanmaktadır. KVKK'nın 5. maddesinin 2. fıkrasındaki "bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması" ve "veri sorumlusunun meşru menfaatleri" hukuki sebeplerine dayanılarak işlenmektedir.

6. Veri Sahibinin Hakları (KVKK Md. 11)
- Kişisel verilerinizin işlenip işlenmediğini öğrenme
- İşlenmişse buna ilişkin bilgi talep etme
- İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
- Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme
- Eksik veya yanlış işlenmişse düzeltilmesini isteme
- KVKK'nın 7. maddesindeki şartlar çerçevesinde silinmesini veya yok edilmesini isteme
- Düzeltme, silme veya yok etme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme
- İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme
- Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme

Başvurularınızı info@renth.com.tr adresine yazılı olarak iletebilirsiniz.`

const TERMS_TEXT = `RENTH KULLANIM KOŞULLARI

1. Genel Hükümler
Bu kullanım koşulları, Renth Müşteri Portalı'nın ("Portal") kullanımına ilişkin şartları düzenler. Portal'a erişim sağlayarak bu koşulları kabul etmiş sayılırsınız.

2. Hesap Güvenliği
- Hesap bilgilerinizin gizliliğinden siz sorumlusunuz
- Şifrenizi üçüncü kişilerle paylaşmayınız
- Yetkisiz erişim tespit ettiğinizde derhal bildiriniz

3. Portal Kullanımı
- Portal yalnızca iş makinesi kiralama hizmetleri kapsamında kullanılabilir
- Yanıltıcı, hatalı veya eksik bilgi vermekten kaçınmalısınız
- Portal üzerinden yapılan tüm talepler ve onaylar bağlayıcıdır

4. Teklif ve Sözleşme Süreçleri
- Portal üzerinden oluşturulan teklif talepleri bağlayıcı değildir
- Teklifler Renth tarafından değerlendirilerek fiyatlandırılır
- Onaylanan teklifler sözleşmeye dönüşür ve yasal bağlayıcılığı vardır

5. Fikri Mülkiyet
Portal'daki tüm içerik, tasarım ve yazılım Renth'e aittir. İzinsiz kopyalanamaz veya çoğaltılamaz.

6. Sorumluluk Sınırlaması
Renth, Portal'ın kesintisiz veya hatasız çalışacağını garanti etmez. Teknik bakım veya güncellemeler nedeniyle geçici kesintiler yaşanabilir.

7. Değişiklikler
Renth, bu kullanım koşullarını önceden bildirimde bulunmaksızın güncelleme hakkını saklı tutar. Güncel koşullar Portal üzerinden erişilebilir durumdadır.

8. İletişim
Sorularınız için info@renth.com.tr adresinden bize ulaşabilirsiniz.

Son güncelleme: Şubat 2026`


const KvkkConsentScreen = ({ user, onConsent, showToast }) => {
  const [kvkkAccepted, setKvkkAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showKvkkModal, setShowKvkkModal] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConsent = async () => {
    if (!kvkkAccepted || !termsAccepted) { showToast('Lütfen tüm sözleşmeleri onaylayın', 'error'); return }
    setLoading(true)
    try {
      const now = new Date().toISOString()
      await supabase.from('users').update({ kvkk_consent_at: now, terms_consent_at: now }).eq('id', user.id)
      logAudit(user.id, user.full_name, 'KVKK_CONSENT', { kvkk: true, terms: true })
      onConsent({ ...user, kvkk_consent_at: now, terms_consent_at: now })
      showToast('Onaylarınız kaydedildi', 'success')
    } catch (e) { showToast('Bir hata oluştu', 'error') }
    setLoading(false)
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
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#111111] via-[#222222] to-[#111111] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#C41E3A]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#C41E3A]/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="mb-12"><Logo size="xl" /></div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-6">Hoş Geldiniz<br /><span className="text-[#C41E3A]">{user?.full_name}</span></h2>
          <p className="text-lg text-gray-400 max-w-md">Devam etmeden önce lütfen aşağıdaki sözleşmeleri onaylayın.</p>
        </div>
      </div>
      <div className="lg:hidden bg-[#111111] p-6 flex items-center justify-center">
        <Logo size="lg" />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-8 bg-gray-50">
        <div className="w-full max-w-lg">
          <Card className="p-6 lg:p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#C41E3A]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#C41E3A]" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Sözleşme Onayı</h2>
              <p className="text-gray-500 mt-2">İlk girişiniz için aşağıdaki sözleşmeleri onaylamanız gerekmektedir.</p>
            </div>

            <div className="space-y-4 mb-8">
              {/* KVKK */}
              <div className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${kvkkAccepted ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`} onClick={() => setKvkkAccepted(!kvkkAccepted)}>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${kvkkAccepted ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'}`}>
                    {kvkkAccepted && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">KVKK Aydınlatma Metni</p>
                    <p className="text-xs text-gray-500 mt-1">6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel verilerimin işlenmesine ilişkin aydınlatma metnini okudum, anladım.</p>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowKvkkModal(true) }} className="text-xs text-[#C41E3A] font-medium mt-2 hover:underline flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Metni oku
                    </button>
                  </div>
                </div>
              </div>

              {/* Kullanım Koşulları */}
              <div className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${termsAccepted ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`} onClick={() => setTermsAccepted(!termsAccepted)}>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${termsAccepted ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'}`}>
                    {termsAccepted && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Kullanım Koşulları</p>
                    <p className="text-xs text-gray-500 mt-1">Renth Müşteri Portalı kullanım koşullarını okudum, kabul ediyorum.</p>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowTermsModal(true) }} className="text-xs text-[#C41E3A] font-medium mt-2 hover:underline flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Metni oku
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <Button variant="primary" size="lg" className="w-full" loading={loading} onClick={handleConsent}
              disabled={!kvkkAccepted || !termsAccepted}>
              {loading ? 'Kaydediliyor...' : 'Onayla ve Devam Et'}
            </Button>

            <p className="text-xs text-gray-400 text-center mt-4">Bu onay tek seferlik olup, hesabınızda kayıt altına alınacaktır.</p>
          </Card>
        </div>
      </div>

      {showKvkkModal && <TextModal title="KVKK Aydınlatma Metni" text={KVKK_TEXT} onClose={() => setShowKvkkModal(false)} />}
      {showTermsModal && <TextModal title="Kullanım Koşulları" text={TERMS_TEXT} onClose={() => setShowTermsModal(false)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HESABIM (MY ACCOUNT) PAGE
// ═══════════════════════════════════════════════════════════════════════════



export default KvkkConsentScreen
