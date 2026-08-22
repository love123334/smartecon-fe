/** Shared Looker Studio embed for Manager dashboard (SEDSP Dashboard). */
export const LOOKER_STUDIO_PLATFORM_REVENUE_URL =
  'https://lookerstudio.google.com/embed/reporting/88f0776f-62a9-409c-8c78-40e9cd4b9f26/page/Y0b5F'

/** Canvas gốc Looker (postMessage có thể ghi đè). Dashboard dài ~2500–3200px. */
export const LOOKER_REPORT_WIDTH_PX = 1280
export const LOOKER_REPORT_HEIGHT_PX = 3000

/** Chiều cao tối đa khung nhúng = gần full viewport (trừ header). */
export function lookerMaxViewportHeight(): number {
  if (typeof window === 'undefined') return 920
  return Math.max(640, Math.min(window.innerHeight - 150, 1400))
}

export const LOOKER_VIEWPORT_HEIGHT_MOBILE_PX = 560

/** @deprecated dùng lookerMaxViewportHeight() */
export const LOOKER_VIEWPORT_HEIGHT_PX = 920
export const LOOKER_EMBED_HEIGHT_PX = LOOKER_VIEWPORT_HEIGHT_PX
export const LOOKER_EMBED_HEIGHT_MOBILE_PX = LOOKER_VIEWPORT_HEIGHT_MOBILE_PX

/** Hide chrome + fit page in embed frame. */
export function lookerEmbedSrc(baseUrl: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('feature', 'embed')
  return url.toString()
}
