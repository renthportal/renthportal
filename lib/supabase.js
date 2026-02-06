import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '')

/** Fix Supabase storage URLs: ensure /public/ is in path */
export const fixStorageUrl = (url) => {
  if (!url) return url
  if (url.includes('/storage/v1/object/') && !url.includes('/storage/v1/object/public/')) {
    return url.replace('/storage/v1/object/', '/storage/v1/object/public/')
  }
  return url
}

/** Resolve image source: if already base64 data URI use directly, otherwise fix storage URL */
export const resolveImageSrc = (url) => {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  return fixStorageUrl(url)
}

/** Compress image file and return as Blob for upload */
export const compressImageToBlob = (file, maxWidth = 1200, quality = 0.7) => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 15000)
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let w = img.width, h = img.height
          if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth }
          canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)
          canvas.toBlob((blob) => { clearTimeout(timeout); resolve(blob) }, 'image/jpeg', quality)
        } catch { clearTimeout(timeout); resolve(null) }
      }
      img.onerror = () => { clearTimeout(timeout); resolve(null) }
      img.src = e.target.result
    }
    reader.onerror = () => { clearTimeout(timeout); resolve(null) }
    reader.readAsDataURL(file)
  })
}

/** Server-side pagination helper using Supabase .range() */
export const paginatedQuery = (query, page, pageSize = 10) => {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return query.range(from, to)
}
