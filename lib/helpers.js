export const openPdfContent = (html) => {
  const isMobileDevice = window.innerWidth < 1024 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  
  if (!isMobileDevice) {
    const win = window.open('', '_blank')
    if (win) { win.document.open(); win.document.write(html); win.document.close(); return }
  }

  // Mobile: full-screen overlay in current page
  const overlay = document.createElement('div')
  overlay.id = 'renth-pdf-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff;display:flex;flex-direction:column;'

  const toolbar = document.createElement('div')
  toolbar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e5e7eb;background:#fff;flex-shrink:0;'
  toolbar.innerHTML = `
    <button id="renth-pdf-back" style="display:flex;align-items:center;gap:6px;font-size:14px;color:#374151;font-weight:500;background:none;border:none;cursor:pointer;padding:8px 12px;border-radius:8px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      Geri Dön
    </button>
    <button id="renth-pdf-print" style="display:flex;align-items:center;gap:6px;font-size:14px;color:#fff;font-weight:600;background:#C41E3A;border:none;cursor:pointer;padding:8px 16px;border-radius:8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Yazdır / PDF
    </button>
  `

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'flex:1;width:100%;border:none;'
  iframe.srcdoc = html

  overlay.appendChild(toolbar)
  overlay.appendChild(iframe)
  document.body.appendChild(overlay)
  document.body.style.overflow = 'hidden'

  toolbar.querySelector('#renth-pdf-back').onclick = () => {
    document.body.removeChild(overlay)
    document.body.style.overflow = ''
  }
  toolbar.querySelector('#renth-pdf-print').onclick = () => {
    if (iframe.contentWindow) iframe.contentWindow.print()
  }
}


