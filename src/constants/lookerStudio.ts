/** Shared Looker Studio embed for Manager dashboard (SEDSP Dashboard). */
export const LOOKER_STUDIO_PLATFORM_REVENUE_URL =
  'https://lookerstudio.google.com/embed/reporting/88f0776f-62a9-409c-8c78-40e9cd4b9f26/page/Y0b5F'

/**
 * Canvas Looker @ 1280px — đo trang Y0b5F (feature=embed): KPI + chart + Top 3 seller, ~900px.
 * FE scale full-width; chiều cao khung = 900 × scale. Không tin postMessage canvas (thường ~1920 → dư trắng).
 */
export const LOOKER_REPORT_WIDTH_PX = 1280
export const LOOKER_REPORT_HEIGHT_PX = 900

/** Hide chrome in embed frame. */
export function lookerEmbedSrc(baseUrl: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('feature', 'embed')
  return url.toString()
}
