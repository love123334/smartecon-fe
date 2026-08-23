/** Shared Looker Studio embed for Manager dashboard (SEDSP Dashboard). */
export const LOOKER_STUDIO_PLATFORM_REVENUE_URL =
  'https://lookerstudio.google.com/embed/reporting/88f0776f-62a9-409c-8c78-40e9cd4b9f26/page/Y0b5F'

/**
 * Canvas Looker @ 1280px — phải đủ cao để báo cáo không scroll bên trong iframe.
 * Đừng hạ xuống ~900: Looker vẫn render dài hơn → thanh kéo nội bộ quay lại.
 * FE scale full-width; chiều cao khung ngoài = canvas × scale.
 */
export const LOOKER_REPORT_WIDTH_PX = 1280
export const LOOKER_REPORT_HEIGHT_PX = 1920

/** Looker postMessage height dưới ngưỡng này thường là chrome/page stub — bỏ qua. */
export const LOOKER_MIN_TRUSTED_HEIGHT_PX = 1200

/** Hide chrome in embed frame. */
export function lookerEmbedSrc(baseUrl: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('feature', 'embed')
  return url.toString()
}
