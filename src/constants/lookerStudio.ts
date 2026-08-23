/** Shared Looker Studio embed for Manager dashboard (SEDSP Dashboard). */
export const LOOKER_STUDIO_PLATFORM_REVENUE_URL =
  'https://lookerstudio.google.com/embed/reporting/88f0776f-62a9-409c-8c78-40e9cd4b9f26/page/Y0b5F'

/**
 * Chiều cao khung ngoài sau khi scale — báo cáo vừa khung, không scrollbar.
 * (Trước đó đổi sang aspect-ratio 900px → Looker lại hiện thanh kéo.)
 */
export const LOOKER_VIEWPORT_HEIGHT_PX = 720
export const LOOKER_VIEWPORT_HEIGHT_MOBILE_PX = 540

/**
 * Canvas gốc trước scale — đủ cao để Looker không scroll nội bộ;
 * CSS scale sẽ thu nhỏ vừa LOOKER_VIEWPORT_HEIGHT / bề ngang.
 */
export const LOOKER_REPORT_WIDTH_PX = 1280
export const LOOKER_REPORT_HEIGHT_PX = 1920

/** Hide chrome in embed frame. */
export function lookerEmbedSrc(baseUrl: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('feature', 'embed')
  return url.toString()
}
