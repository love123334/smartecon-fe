/** Shared Looker Studio embed for Manager dashboard (SEDSP Dashboard). */
export const LOOKER_STUDIO_PLATFORM_REVENUE_URL =
  'https://lookerstudio.google.com/embed/reporting/88f0776f-62a9-409c-8c78-40e9cd4b9f26/page/Y0b5F'

/**
 * Outer box after CSS scale — full report must remain visible (no crop).
 * Tall enough to read KPIs; page may scroll, iframe must not.
 */
export const LOOKER_VIEWPORT_HEIGHT_PX = 820
export const LOOKER_VIEWPORT_HEIGHT_MOBILE_PX = 580

/**
 * Looker page canvas (before scale). Sized to the real dashboard layout
 * (4 KPIs + 2 mid charts + 1 bottom) — not an oversized 1920 canvas that
 * forces tiny scale / odd clipping, and not a short crop that cuts widgets.
 */
export const LOOKER_REPORT_WIDTH_PX = 1200
export const LOOKER_REPORT_HEIGHT_PX = 1180

/** @deprecated use LOOKER_VIEWPORT_HEIGHT_PX */
export const LOOKER_EMBED_HEIGHT_PX = LOOKER_VIEWPORT_HEIGHT_PX
/** @deprecated use LOOKER_VIEWPORT_HEIGHT_MOBILE_PX */
export const LOOKER_EMBED_HEIGHT_MOBILE_PX = LOOKER_VIEWPORT_HEIGHT_MOBILE_PX

/** Hide chrome in embed frame. */
export function lookerEmbedSrc(baseUrl: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('feature', 'embed')
  return url.toString()
}
