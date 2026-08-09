/** Resolve / repair product image URLs (many Unsplash seeds in DB now 404). */

import { apiConfig } from '@/api/config'

const U = (id: string) => `https://images.unsplash.com/${id}?w=800&q=80`

/** Known-dead Unsplash photo ids → working replacements */
const BROKEN_PHOTO_REPLACEMENTS: Record<string, string> = {
  'photo-1596755094514-f87e34085b85': U('photo-1602810318383-e386cc2a3ccf'), // casual shirt
  'photo-1614252235816-8c852f74fa71': U('photo-1460353581641-37baddab0fa2'), // oxford shoes
  'photo-1620916569889-0f1dd397713b': U('photo-1556228720-195a672e8a03'), // serum
  'photo-1586495777744-4413f2103256': U('photo-1596462502278-27bfdc403348'), // lipstick
  'photo-1591290619762-c588f7cb0f81': U('photo-1583863788434-e58a36330cf0'), // wireless pad
  'photo-1578500494198-242dcfb7a7e2': U('photo-1610701596007-11502861dcfa'), // vase
  'photo-1585515320310-259814833e87': U('photo-1556910103-1c02745aae4d'), // air fryer
  'photo-1556911220-bff31c5750ea': U('photo-1556909114-f6e7ad7d3136'), // kitchen
  'photo-1513519245088-0e12902e35a6': U('photo-1579783902614-a3fb3927b6a5'), // wall art
  'photo-1563861826100-9cbac140d88b': U('photo-1507473885765-e6ed057f782c'), // clock/lamp
  'photo-1584990347449-39b4c0c0c0c0': U('photo-1556910103-1c02745aae4d'), // fake cookware id
  'photo-1571781926291-c77df8098c7f': U('photo-1556228720-195a672e8a03'), // cleanser alt
}

const CATEGORY_FALLBACKS: Record<string, string> = {
  'điện thoại': U('photo-1511707171634-5f897ff02aa9'),
  laptop: U('photo-1496181133206-80ce9b88a853'),
  'phụ kiện': U('photo-1583863788434-e58a36330cf0'),
  'thời trang': U('photo-1489987707025-afc232f7ea0f'),
  'thời trang nam': U('photo-1602810318383-e386cc2a3ccf'),
  'thời trang nữ': U('photo-1595777457583-95e059d581b8'),
  'giày dép': U('photo-1549298916-b41d501d3772'),
  'chăm sóc da': U('photo-1556228720-195a672e8a03'),
  'trang điểm': U('photo-1596462502278-27bfdc403348'),
  'nhà bếp': U('photo-1556910103-1c02745aae4d'),
  'nội thất': U('photo-1493663284031-b7e3aefcae8e'),
  'gia dụng': U('photo-1556909114-f6e7ad7d3136'),
  'điện tử': U('photo-1505740420928-5e560c06d30e'),
  'đồ dã ngoại': U('photo-1478131143081-80f7f84ca84d'),
}

/** Stable SVG data-URI last resort (no network) */
export const PRODUCT_IMAGE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 800 800'%3E%3Crect fill='%23eef2f7' width='800' height='800'/%3E%3Crect x='280' y='260' width='240' height='180' rx='16' fill='%23d5dee8'/%3E%3Ccircle cx='340' cy='320' r='28' fill='%23b8c5d4'/%3E%3Cpath d='M300 420l60-70 50 55 40-35 70 80H300z' fill='%23b8c5d4'/%3E%3Ctext x='400' y='520' text-anchor='middle' fill='%23788aa5' font-family='system-ui,sans-serif' font-size='28'%3ESEDSP%3C/text%3E%3C/svg%3E"

function photoIdFromUrl(url: string): string | null {
  const m = url.match(/photo-[a-zA-Z0-9-]+/)
  return m ? m[0] : null
}

function backendOrigin(): string {
  return apiConfig.backendOrigin.replace(/\/$/, '')
}

/** localhost / relative /uploads → Railway (prod) or local BE (dev) */
export function resolvePublicAssetUrl(url: string | null | undefined): string {
  const raw = (url ?? '').trim()
  if (!raw) return ''
  const origin = backendOrigin()

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(raw)) {
    try {
      const u = new URL(raw)
      return `${origin}${u.pathname}${u.search}`
    } catch {
      return raw.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, origin)
    }
  }

  if (raw.startsWith('/uploads/')) {
    return `${origin}${raw}`
  }

  return raw
}

export function repairProductImageUrl(
  url: string | null | undefined,
  opts?: { seed?: string | number; category?: string },
): string {
  const raw = resolvePublicAssetUrl(url)
  if (!raw) {
    return categoryFallback(opts?.category) || seedFallback(opts?.seed)
  }

  // Prefer Unsplash over flaky picsum redirects in some networks
  if (/picsum\.photos/i.test(raw)) {
    return categoryFallback(opts?.category) || seedFallback(opts?.seed)
  }

  const id = photoIdFromUrl(raw)
  if (id && BROKEN_PHOTO_REPLACEMENTS[id]) {
    return BROKEN_PHOTO_REPLACEMENTS[id]
  }

  return raw
}

function categoryFallback(category?: string): string {
  if (!category) return ''
  const key = category.trim().toLowerCase()
  return CATEGORY_FALLBACKS[key] || ''
}

function seedFallback(seed?: string | number): string {
  const s = encodeURIComponent(String(seed ?? 'sedsp'))
  return U(`photo-1523275335684-37898b6baf30`) + `&sig=${s}`
}

/**
 * img @error handler — try next candidates then SVG placeholder.
 * Mark element with data-fallback-step to avoid infinite loops.
 */
export function handleProductImageError(
  event: Event,
  candidates: string[] = [],
): void {
  const img = event.target as HTMLImageElement | null
  if (!img) return
  const step = Number(img.dataset.fallbackStep ?? '0')
  const pool = candidates
    .map((u) => repairProductImageUrl(u))
    .filter((u) => u && u !== img.src)

  if (step < pool.length) {
    img.dataset.fallbackStep = String(step + 1)
    img.src = pool[step]
    return
  }
  img.dataset.fallbackStep = String(step + 1)
  img.src = PRODUCT_IMAGE_DATA_URI
  img.onerror = null
}
