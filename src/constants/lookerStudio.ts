/** Shared Looker Studio embed for Manager dashboard (SEDSP Dashboard). */
export const LOOKER_STUDIO_PLATFORM_REVENUE_URL =
  'https://lookerstudio.google.com/embed/reporting/88f0776f-62a9-409c-8c78-40e9cd4b9f26/page/Y0b5F'

/** Fixed outer box height — report is scaled down to fit (no scrollbars). */
export const LOOKER_VIEWPORT_HEIGHT_PX = 680
export const LOOKER_VIEWPORT_HEIGHT_MOBILE_PX = 520

/** Natural report canvas size before CSS scale (postMessage may override height). */
export const LOOKER_REPORT_WIDTH_PX = 1280
export const LOOKER_REPORT_HEIGHT_PX = 1920

/** @deprecated use LOOKER_VIEWPORT_HEIGHT_PX */
export const LOOKER_EMBED_HEIGHT_PX = LOOKER_VIEWPORT_HEIGHT_PX
/** @deprecated use LOOKER_VIEWPORT_HEIGHT_MOBILE_PX */
export const LOOKER_EMBED_HEIGHT_MOBILE_PX = LOOKER_VIEWPORT_HEIGHT_MOBILE_PX

/** Hide chrome + fit page in embed frame. */
export function lookerEmbedSrc(baseUrl: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('feature', 'embed')
  return url.toString()
}
