import { RENTAL_TYPES, PAYMENT_TERMS, CURRENCIES } from './constants'
import { openPdfContent } from './helpers'

export const RENTH_LOGO_B64 = 'data:image/jpeg;base64,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'


const generateProposalPDF = (proposal, quoteItems, companyData, salesRep) => {
  const sym = (c) => c === 'USD' ? '$' : c === 'EUR' ? '€' : '₺'
  const currency = sym(proposal.currency || 'TRY')
  const paymentLabel = PAYMENT_TERMS.find(p => p.value === (proposal.payment_term || 'CASH'))?.label || proposal.payment_term
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const validUntil = proposal.valid_until ? new Date(proposal.valid_until).toLocaleDateString('tr-TR') : ''
  const companyName = companyData?.name || proposal.company?.name || ''
  const companyAddress = companyData?.address || ''
  const companyTaxOffice = companyData?.tax_office || ''
  const companyTaxNumber = companyData?.tax_number || ''
  const contactName = companyData?.contact_name || ''
  const repName = salesRep?.full_name || ''
  const repPhone = salesRep?.phone || ''
  const repEmail = salesRep?.email || ''
  const proposalNumber = proposal.proposal_number || ''
  const notes = proposal.notes || ''
  const addressMatch = notes.match(/Teslimat Adresi:\n([^\n]+(?:\n[^\n]+)?)/i)
  const deliveryAddress = addressMatch ? addressMatch[1].trim() : companyAddress
  const generalNotes = notes.match(/(?:Notlar|Genel Notlar):\n([\s\S]*?)(?:\n\nKiralama Temsilcisi:|$)/i)
  const notesText = generalNotes ? generalNotes[1].trim() : ''

  const items = quoteItems || []
  const grandOriginal = items.reduce((s, i) => s + (i.rental_price || 0) * (i.duration || 1) + (i.transport_price || 0), 0)
  const grandDiscounted = items.reduce((s, i) => s + ((i.rental_price || 0) - (i.rental_discount || 0)) * (i.duration || 1) + ((i.transport_price || 0) - (i.transport_discount || 0)), 0)
  const hasAnyDiscount = grandOriginal !== grandDiscounted
  const totalDiscount = grandOriginal - grandDiscounted

  const itemRows = items.map((item, i) => {
    const rentalNet = (item.rental_price || 0) - (item.rental_discount || 0)
    const transportNet = (item.transport_price || 0) - (item.transport_discount || 0)
    const itemTotal = rentalNet * (item.duration || 1) + transportNet
    const hasRentalDiscount = (item.rental_discount || 0) > 0
    const hasTransportDiscount = (item.transport_discount || 0) > 0
    const rentalCell = hasRentalDiscount
      ? `<span style="text-decoration:line-through;color:#999;font-size:10px;">${currency}${Number(item.rental_price || 0).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span><br><span style="font-weight:700;color:#2E7D32;">${currency}${Number(rentalNet).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>`
      : `<span style="font-weight:600;">${currency}${Number(item.rental_price || 0).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>`
    const transportCell = hasTransportDiscount
      ? `<span style="text-decoration:line-through;color:#999;font-size:10px;">${currency}${Number(item.transport_price || 0).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span><br><span style="font-weight:700;color:#2E7D32;">${currency}${Number(transportNet).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>`
      : `<span style="font-weight:600;">${currency}${Number(item.transport_price || 0).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>`
    return `<tr>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${i + 1}</td>
      <td style="padding:10px;border:1px solid #ddd;font-weight:600;">${item.machine_type || ''}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${item.duration || 1} ${item.period || 'Ay'}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:right;">${rentalCell}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:right;">${transportCell}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:right;font-weight:700;font-size:13px;">${currency}${Number(itemTotal).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td>
    </tr>`
  }).join('')

  const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>Kiralama Teklif Formu - ${proposalNumber}</title>
<style>
@page { margin: 20mm 15mm; size: A4; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #222; line-height: 1.5; }
.page { page-break-after: always; padding: 0; }
.page:last-child { page-break-after: auto; }
.header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #C41E3A; padding-bottom: 15px; margin-bottom: 20px; }
.logo-area { display: flex; align-items: center; gap: 12px; }
.logo-area img { height: 52px; object-fit: contain; }
.doc-info { text-align: right; font-size: 11px; color: #555; }
.doc-info .num { font-size: 16px; font-weight: 700; color: #222; }
.section-title { font-size: 14px; font-weight: 700; color: #C41E3A; border-bottom: 2px solid #C41E3A; padding-bottom: 4px; margin: 20px 0 10px; }
table.items { width: 100%; border-collapse: collapse; font-size: 10.5px; margin: 15px 0; }
table.items th { background: #C41E3A; color: #fff; padding: 8px 6px; border: 1px solid #C41E3A; font-weight: 600; text-align: center; font-size: 10px; }
table.items td { border: 1px solid #ddd; }
table.items tr:nth-child(even) td { background: #f9f9f9; }
.total-row { background: #FFF3E0 !important; font-weight: 700; font-size: 13px; }
.discount-row { background: #E8F5E9 !important; font-weight: 600; font-size: 11px; color: #2E7D32; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
.info-box { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; }
.info-box .lbl { font-size: 10px; color: #888; text-transform: uppercase; font-weight: 600; }
.info-box .val { font-size: 13px; font-weight: 600; color: #222; margin-top: 2px; }
.cover-letter { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 25px; margin: 20px 0; font-size: 13px; line-height: 1.8; }
.terms { font-size: 10.5px; line-height: 1.6; color: #444; margin-top: 15px; }
.terms li { margin-bottom: 6px; }
.contract-terms { margin-top: 10px; }
.contract-terms h3 { font-size: 13px; font-weight: 700; color: #C41E3A; margin-bottom: 8px; border-bottom: 2px solid #C41E3A; padding-bottom: 4px; }
.contract-terms p { font-size: 9.5px; line-height: 1.5; color: #333; margin-bottom: 3px; text-align: justify; }
.contract-terms p strong { color: #222; }
.signature-area { display: flex; justify-content: space-between; margin-top: 40px; }
.signature-box { width: 45%; text-align: center; border-top: 2px solid #222; padding-top: 10px; font-weight: 600; font-size: 11px; }
.footer { text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 8px; margin-top: 30px; }
@media print { body { margin: 0; } .no-print { display: none; } }
</style></head>
<body>
<div class="no-print" style="background:#C41E3A;color:#fff;padding:12px 20px;text-align:center;font-size:14px;font-weight:600;cursor:pointer;" onclick="window.print()">📄 PDF olarak kaydetmek için tıklayın veya Ctrl+P basın</div>

<!-- SAYFA 1: KAPAK + TEKLİF -->
<div class="page">
  <div class="header">
    <div class="logo-area">
      <img src="${RENTH_LOGO_B64}" alt="RENTH" />
    </div>
    <div class="doc-info">
      <div class="num">${proposalNumber}</div>
      <div>Tarih: ${today}</div>
      ${validUntil ? `<div>Geçerlilik: ${validUntil}</div>` : ''}
    </div>
  </div>

  <div class="cover-letter">
    Sn. <strong>${contactName || companyName}</strong>,<br><br>
    &nbsp;&nbsp;&nbsp;Talep etmiş olduğunuz ürün/ürünlerimiz ile ilgili, firmanız için hazırlanmış teklifimiz aşağıdadır. İş bu teklifimizin olumlu değerlendirilmesini ümit eder, iyi çalışmalar dileriz.<br><br>
    &nbsp;&nbsp;&nbsp;Saygılarımızla;<br><br>
    <strong>${repName}</strong><br>
    ${repPhone ? repPhone + '<br>' : ''}
    ${repEmail || ''}
  </div>

  <div class="info-grid">
    <div class="info-box"><div class="lbl">Müşteri</div><div class="val">${companyName}</div></div>
    <div class="info-box"><div class="lbl">Teslimat Adresi</div><div class="val">${deliveryAddress || companyAddress || '-'}</div></div>
    <div class="info-box"><div class="lbl">Vergi Dairesi / No</div><div class="val">${companyTaxOffice || '-'} / ${companyTaxNumber || '-'}</div></div>
    <div class="info-box"><div class="lbl">Ödeme Vadesi</div><div class="val">${paymentLabel}</div></div>
  </div>

  <div class="section-title">TEKLİF KALEMLERİ</div>
  <table class="items">
    <thead><tr>
      <th style="width:4%">#</th>
      <th>Makine / Hizmet</th>
      <th style="width:9%">Süre</th>
      <th style="width:16%">Birim Kiralama Tutarı</th>
      <th style="width:14%">Nakliye Tutarı</th>
      <th style="width:15%">Toplam</th>
    </tr></thead>
    <tbody>
      ${itemRows}
      ${hasAnyDiscount ? `<tr class="discount-row">
        <td colspan="5" style="padding:10px;border:1px solid #ddd;text-align:right;">Toplam İndirim</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:right;font-size:12px;color:#2E7D32;font-weight:700;">-${currency}${Number(totalDiscount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td>
      </tr>` : ''}
      <tr class="total-row">
        <td colspan="5" style="padding:12px;border:1px solid #ddd;text-align:right;">${hasAnyDiscount ? '<span style="text-decoration:line-through;color:#999;font-size:11px;margin-right:10px;">Liste: ' + currency + Number(grandOriginal).toLocaleString('tr-TR', {minimumFractionDigits:2}) + '</span> ' : ''}GENEL TOPLAM (KDV Hariç)</td>
        <td style="padding:12px;border:1px solid #ddd;text-align:right;font-size:15px;color:#C41E3A;font-weight:700;">${currency}${Number(grandDiscounted).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td>
      </tr>
    </tbody>
  </table>

  <div class="terms">
    <ul>
      <li>Fiyatlara KDV dahil değildir.</li>
      <li>Kullanım yeri: <strong>${deliveryAddress || '-'}</strong></li>
      <li>Kira süresi KİRACI'nın talebi üzerine belirlenmiş olup, mutabık kalınmış olunan bu sürenin son bulmasına kadar, taraflardan herhangi biri tarafından yazılı olarak kiralama süresinin uzatılmadığı sürece, belirtilen şartlarla otomatik olarak uzamaya devam eder.</li>
      <li>Min. kiralama süresi bittiğinde Kiraya verenin fiyat değiştirme hakkı saklıdır.</li>
      <li>Makineye ait tüm bakım, onarım (kullanıcı hatası hariç), periyodik kontrol, muayene masrafları RENTH'e aittir.</li>
      <li>Taraflar arasında herhangi bir uyuşmazlık ortaya çıkması durumunda İstanbul Anadolu Mahkemeleri ve İcra Daireleri yetkili olacaktır.</li>
      <li>Kiralama Ödeme Şekli: <strong>${paymentLabel}</strong></li>
      ${notesText ? `<li>NOT: ${notesText}</li>` : ''}
    </ul>
  </div>

  <div style="text-align:center;margin-top:20px;font-size:10px;color:#888;">RENTH bir HAREKET markasıdır.</div>

  <div class="signature-area">
    <div class="signature-box">KİRAYA VEREN<br>KAŞE / İMZA</div>
    <div class="signature-box">KİRACI<br>KAŞE / İMZA</div>
  </div>

  <div class="footer">HAREKET PROJE TAŞIMACILIĞI VE YÜK MÜHENDİSLİĞİ A.Ş. — EYÜP SULTAN MAH. SEKMEN CAD. NO. 28 SAMANDIRA-SANCAKTEPE/İSTANBUL</div>
</div>

<!-- SAYFA 2: SÖZLEŞME MADDELERİ -->
<div class="page">
  <div class="header">
    <div class="logo-area">
      <img src="${RENTH_LOGO_B64}" alt="RENTH" />
    </div>
    <div class="doc-info">
      <div class="num">${proposalNumber}</div>
      <div>Sözleşme Maddeleri</div>
    </div>
  </div>

  <div class="contract-terms">
    <h3>KİRALAMA SÖZLEŞMESİ</h3>

    <p><strong>MADDE-1 : TARAFLAR</strong></p>
    <p>İşbu kira sözleşmesi: HAREKET PROJE TAŞIMACILIĞI VE YÜK MÜHENDİSLİĞİ A.Ş., adres: EYÜP SULTAN MAH. SEKMEN CAD. NO. 28 SAMANDIRA-SANCAKTEPE/İSTANBUL (bundan böyle kısaca KİRAYA VEREN olarak adlandırılacaktır.) ile yukarıda bilgileri bulunan Müşteri (bundan böyle KİRACI olarak adlandırılacaktır.) arasında aşağıdaki şartlarla düzenlenmiştir.</p>

    <p><strong>MADDE-2 : TANIMLAR</strong></p>
    <p>2.1 MAKİNE: İşbu sözleşme konusu, mülkiyeti KİRAYA VEREN'e ait olan Teklif'de listelenmiş MAKİNE/MAKİNELER ve EKİPMAN/EKİPMANLAR'ı ifade eder.</p>
    <p>2.2 OPERATÖR: İşbu Sözleşme konusu MAKİNE/MAKİNELER'i kullanan, OPERATÖR eğitimi almış ve sertifikaya sahip her bir kullanıcıyı ifade eder.</p>

    <p><strong>MADDE-3 : SÖZLEŞMENİN KONUSU</strong></p>
    <p>Mülkiyeti KİRAYA VEREN'e ait olan, kiralama formunda bilgileri verilen MAKİNE/MAKİNELER'in işbu sözleşmede belirtilen şartlarla kiraya verilmesi ve tarafların karşılıklı hak ve yükümlülüklerinin belirlenmesidir. İşbu kiralama sözleşmesi ile KİRACI'ya kiralanan MAKİNE/MAKİNELER'in kullanılacağı iş ile KİRAYA VEREN'in hiçbir bağı yoktur. MAKİNE/MAKİNELER'in KİRACI'ya tesliminden KİRAYA VEREN'e iadesine kadar meydana gelebilecek her hangi bir zarar, adli/idari para cezaları ve tazmin yükü getiren her türlü sorumluluk KİRACI'ya aittir.</p>

    <p><strong>MADDE-4 : MAKİNE/MAKİNELER'İN KULLANIM YERİ VE YER DEĞİŞİKLİĞİ</strong></p>
    <p>4.1: MAKİNE/MAKİNELER'in kullanım yeri EK-1'de belirtilmiştir.</p>
    <p>4.2: KİRACI, KİRAYA VEREN'e haber vermeksizin kiralanan MAKİNE/MAKİNELER'i belirtilmiş olan tesis dışına götüremez, sevk edemez ve çalıştıramaz. Yazılı onay alınmaksızın kullanım yerinin değiştirilmesi durumunda sözleşme KİRAYA VEREN'in yazılı bildirimini müteakip fesih olacaktır.</p>

    <p><strong>MADDE-5 : KİRALAMA SÜRESİ</strong></p>
    <p>5.1: MAKİNE/MAKİNELER'in kiralama süresi her bir makine için ayrı ayrı EK-1'de belirtilmiştir.</p>
    <p>5.2: Kira süresi KİRACI'nın talebi üzerine belirlenmiş olup, mutabık kalınmış olunan bu sürenin son bulmasına kadar, taraflardan herhangi biri tarafından yazılı olarak kiralama süresinin uzatılmadığı ve/veya bu süre sonunda MAKİNE/MAKİNELER'in geri alınmasının talep edilmediği sürece, kiralama aynı birim kiralama tutarı üzerinden aynı şartlarla otomatik olarak uzamaya devam eder.</p>

    <p><strong>MADDE-6 : TESLİM TESELLÜM VE KULLANIMI</strong></p>
    <p>6.1: Nakliyenin KİRACI tarafından yapılması durumunda KİRAYA VEREN'in merkezinde ya da şubelerinde nakliyeciye yapılmış olan teslimat KİRACI'ya yapılmış sayılacaktır.</p>
    <p>6.2: KİRACI'nın MAKİNE/MAKİNELER'in teslimi için herhangi bir çalışanına ya da tayin ettiği kişiye/kişilere MAKİNE/MAKİNELER'in teslim edilmesi KİRACI'ya teslim edilmiş hükmündedir.</p>

    <p><strong>MADDE-7 : KİRA BEDELİ VE ÖDEME ŞEKLİ</strong></p>
    <p>7.1: MAKİNE/MAKİNELER'in kira bedeli ve diğer hizmet bedelleri mutabık kalınan vadeleriyle birlikte kiralama formunda belirtilmiştir. Ödemeler Euro olarak aynen ödenebileceği gibi ödeme tarihindeki T.C.M.B. döviz satış kuru karşılığı olan TL cinsinden de ödenebilir. Ödemelerin gününde yapılmaması halinde EURO bazında aylık %10 ve Türk Lirası bazında aylık %25 gecikme faizi uygulanacaktır.</p>

    <p><strong>MADDE-8 : MÜLKİYET</strong></p>
    <p>8.1: Mülkiyeti kesinlikle KİRAYA VEREN'e ait olan MAKİNE/MAKİNELER için hiçbir şekilde KİRACI ve 3. Şahıslar tarafından mülkiyet ve hak iddiasında bulunulamaz, kiralanamaz, rehin edilemez, satılamaz.</p>
    <p>8.2: Kiralanan MAKİNE/MAKİNELER karşılık ve teminat olarak gösterilemez, üzerinde haciz işlemi yapılamaz.</p>

    <p><strong>MADDE-9 : KİRACI'NIN KULLANIM İLE İLGİLİ SORUMLULUĞU</strong></p>
    <p>9.1: KİRACI, kiralanan MAKİNE/MAKİNELER'i kapasite ve amacına, iş güvenliği kural ve yönetmeliklerine uygun olarak kullanabilir.</p>
    <p>9.2: KİRACI, kiralanan MAKİNE/MAKİNELER için çalışma sahasında her türlü emniyeti almış olmalıdır. Yangın, sabotaj ve benzeri nedenlerden dolayı doğabilecek zarara karşı KİRACI gerekli mali sorumluluk sigortalarını yaptırmakla yükümlüdür.</p>
    <p>9.3: MAKİNE/MAKİNELER'in kullanımı sırasında KİRACI'nın çalışanlarının, çevresinin ve üçüncü şahısların uğrayacağı zararlardan KİRAYA VEREN kesinlikle sorumlu olmayıp KİRACI sorumludur.</p>
    <p>9.4: Kullanıcıların eğitim alma ihtiyaçlarını belirlemek ve makinelerin kullanımını ehil personele yaptırmak KİRACI'nın sorumluluğundadır.</p>
    <p>9.5: Kiralanan MAKİNE/MAKİNELER'in belirtilen çalışma talimatlarına ve iş güvenliği kural ve yönetmeliklerine uygun şekilde kullanılmasından KİRACI sorumlu olup, aykırı kullanım nedeni ile doğacak her türlü tazmin yükü, hasar ve zararlar KİRACI'ya aittir.</p>
    <p>9.6: KİRACI kiralama süresi boyunca MAKİNE/MAKİNELER'in arızalanması durumunda KİRAYA VEREN'e derhal yazılı olarak bildirim yapmakla yükümlüdür.</p>
    <p>9.7: Kiralanan MAKİNE/MAKİNELER'in çalınması, kaybolması, KİRACI'nın kusuru ile hasarlanması, kullanılamaz hale gelmesi durumunda KİRACI rayiç değerini 10 gün içinde nakden ve defaten ödemekle yükümlüdür.</p>
    <p>9.8: KİRACI, teslim tarihinden fiilen iadesine kadar MAKİNE/MAKİNELER'i korumakla, ehil personelle, garanti şartlarına ve teknik kapasiteye uygun şekilde özenle kullanmakla yükümlüdür.</p>
    <p>9.9: MAKİNE/MAKİNELER'de meydana gelecek arızalar derhal KİRAYA VEREN'e yazılı olarak bildirilecek, onarımlar KİRAYA VEREN'in bilgi, gözetim ve denetimi altında orijinal parça ve malzemelerle yapılacaktır.</p>
    <p>9.10: MAKİNE/MAKİNELER'in her türlü yakıt/enerji giderleri KİRACI'ya aittir.</p>

    <p><strong>MADDE-10 : MAKİNE/MAKİNELER'İN İADESİ</strong></p>
    <p>10.1: Kira süresinin sonunda veya sözleşmenin feshi halinde KİRACI, derhal MAKİNE/MAKİNELER'i evraklarıyla birlikte teslim aldığı gibi iyi halde iade edecektir.</p>
    <p>10.2: KİRAYA VEREN iade sonrası MAKİNE/MAKİNELER'deki hasar ve eksiklikleri giderip masrafları KİRACI'ya fatura eder.</p>
    <p>10.3: MAKİNE/MAKİNELER'in iade edildiğini ispatlama külfeti KİRACI'ya aittir.</p>

    <p><strong>MADDE-11 : KAZA, HASAR, ÇALINMA</strong></p>
    <p>11.1: Kullanıcının kusuru ve/veya çalışma ortamının olumsuz şartları nedeniyle MAKİNE/MAKİNELER'de meydana gelen her türlü hasarlar KİRACI'ya fatura edilecektir.</p>
    <p>11.2: Kazalarda gerekli belgelerin asılları veya tasdikli fotokopileri kaza tarihinden itibaren en geç 3 iş günü içerisinde KİRAYA VEREN'e ulaştırılacaktır.</p>
    <p>11.3: Kira konusu MAKİNE/MAKİNELER'in karışabileceği kazalar nedeniyle doğması muhtemel her türlü zarardan KİRACI sorumlu olacaktır.</p>
    <p>11.4: MAKİNE/MAKİNELER'in KİRACI'nın kusuru/ihmali sonucunda çalınması durumunda KİRACI tüm zararları karşılamakla yükümlüdür.</p>

    <p><strong>MADDE-12 : FESİH HAKKI VE UYUŞMAZLIK</strong></p>
    <p>12.1: KİRACI'nın sözleşme şartlarından herhangi birine aykırı davranması, ödeme güçlüğüne düşmesi veya benzeri hallerde KİRAYA VEREN tek taraflı olarak sözleşmeyi haklı nedenle feshedebilir.</p>
    <p>12.2: Sözleşmenin feshinden ve MAKİNE/MAKİNELER'in iadesinden sonra dahi KİRACI'nın sözleşmeden doğan tüm yükümlülük ve sorumlulukları aynen devam eder.</p>
    <p>Taraflar arasında herhangi bir uyuşmazlık ortaya çıkması durumunda İstanbul Anadolu Mahkemeleri ve İcra Daireleri yetkili olacaktır. Taraflar, kiraya verenin ticari defterlerinin HMK kapsamında kesin delil niteliği arz ettiğini kabul etmektedir.</p>
  </div>

  <div style="margin-top:30px;padding:15px;background:#FFF3E0;border-radius:8px;border:1px solid #FFE0B2;">
    <p style="font-size:11px;color:#E65100;font-weight:600;margin-bottom:5px;">⚠ ÖNEMLİ NOT</p>
    <p style="font-size:10px;color:#555;line-height:1.6;">Bu teklif ve eki niteliğindeki sözleşme maddeleri, tarafların karşılıklı imzalamasıyla yürürlüğe girer. Teklif geçerlilik süresi içinde onaylanmayan teklifler geçersiz sayılır. Teklif bedelleri, geçerlilik süresi sonrası güncellenebilir.</p>
  </div>

  <div class="signature-area">
    <div class="signature-box">
      KİRAYA VEREN<br>
      HAREKET PROJE TAŞIMACILIĞI VE YÜK MÜHENDİSLİĞİ A.Ş.<br>
      <br><br>
      KAŞE / İMZA
    </div>
    <div class="signature-box">
      KİRACI<br>
      ${companyName}<br>
      <br><br>
      KAŞE / İMZA
    </div>
  </div>

  <div class="footer">HAREKET PROJE TAŞIMACILIĞI VE YÜK MÜHENDİSLİĞİ A.Ş. — EYÜP SULTAN MAH. SEKMEN CAD. NO. 28 SAMANDIRA-SANCAKTEPE/İSTANBUL</div>
</div>
</body></html>`

  openPdfContent(htmlContent)
}

// ═══════════════════════════════════════════════════════════════════════════
// VISITS (ZİYARET TAKİP) PAGE
// ═══════════════════════════════════════════════════════════════════════════



export { generateProposalPDF }
