/** Shared Looker Studio embed for Manager dashboard (SEDSP Dashboard). */
export const LOOKER_STUDIO_PLATFORM_REVENUE_URL =
  'https://lookerstudio.google.com/embed/reporting/88f0776f-62a9-409c-8c78-40e9cd4b9f26/page/Y0b5F'

/** Default iframe height before Looker postMessage resize. */
export const LOOKER_EMBED_HEIGHT_PX = 720
export const LOOKER_EMBED_HEIGHT_MOBILE_PX = 560

/** Hide chrome + fit page in embed frame. */
export function lookerEmbedSrc(baseUrl: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('feature', 'embed')
  return url.toString()
}
