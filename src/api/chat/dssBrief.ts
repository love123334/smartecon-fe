/** Tóm tắt DSS cho chatbot — ưu tiên API thật, không bịa số mock. */
import { formatVnd } from '@/api/chat/match'
import type { Product } from '@/types'

function pickFocusProduct(catalog: Product[]): Product | null {
  if (!catalog.length) return null
  return [...catalog].sort((a, b) => b.soldCount - a.soldCount)[0]
}

export function demandBrief(catalog: Product[]): string {
  const focus = pickFocusProduct(catalog)
  if (!focus) {
    return '• Chưa có sản phẩm trong catalog để dự báo. Mở **DSS → Dự báo nhu cầu** sau khi có đơn DELIVERED.'
  }
  return [
    `• SP trọng tâm (catalog): **${focus.name}**`,
    `• Chatbot không tự bịa số dự báo — cần chạy **API DSS** trên đơn đã giao.`,
    `→ Mở **DSS → Dự báo nhu cầu** và chọn SP này.`,
  ].join('\n')
}

export function priceBrief(catalog: Product[]): string {
  const focus = pickFocusProduct(catalog)
  if (!focus) {
    return '• Chưa có sản phẩm để gợi ý giá. Chạy **DSS → Khuyến nghị giá** trên SP thật.'
  }
  return [
    `• SP: **${focus.name}** · giá hiện tại **${formatVnd(focus.price)}**`,
    `• Chưa có số liệu elasticity từ API — không dùng mock.`,
    `→ **DSS → Khuyến nghị giá** để tính trên lịch sử giá / bán thật.`,
  ].join('\n')
}

export function inventoryDssBrief(catalog: Product[]): string {
  const lowLive = catalog.filter((p) => p.stock > 0 && p.stock < 20).slice(0, 5)
  const out = catalog.filter((p) => p.stock <= 0).slice(0, 5)
  const lines = ['• Tồn kho theo catalog hiện tại (không dùng mock DSS):']
  if (!catalog.length) {
    return '• Chưa tải được catalog seller. Đăng nhập lại rồi mở **DSS → Khuyến nghị tồn kho**.'
  }
  if (out.length) {
    lines.push('**Hết hàng:**')
    for (const p of out) lines.push(`• ${p.name}: **0**`)
  }
  if (lowLive.length) {
    lines.push('**Tồn thấp:**')
    for (const p of lowLive) lines.push(`• ${p.name}: còn **${p.stock}**`)
  }
  if (!out.length && !lowLive.length) {
    lines.push('• Các SP đang xem có tồn ổn định — chạy API DSS để có ROP chính xác.')
  }
  lines.push('→ **DSS → Khuyến nghị tồn kho**.')
  return lines.join('\n')
}

export function sellerWhatIfBrief(discountPct = 10): string {
  return [
    `• What-if giảm **${discountPct}%** cần API trên SP có dự báo nhu cầu + giá.`,
    `• Không dùng số demo giả — mở **/seller/dss/what-if** và chọn SP thật.`,
  ].join('\n')
}

/** Live DSS via backend — báo lỗi thật, không fallback số liệu bịa. */
export async function demandBriefLive(catalog: Product[]): Promise<string> {
  const focus = pickFocusProduct(catalog)
  if (!focus?.id || !/^\d+$/.test(focus.id)) return demandBrief(catalog)
  try {
    const { dssApi } = await import('@/api/services')
    const r = await dssApi.forecastDemand({
      productId: focus.id,
      historyDays: 30,
      forecastDays: 14,
    })
    return [
      `• Nguồn: **API DSS** (${r.method || 'moving_average'})`,
      `• SP: **${r.productName || focus.name}**`,
      `• TB bán/ngày: **${r.averageDailyDemand}**`,
      `• Dự báo ${r.forecastDays} ngày: **${r.predictedDemand}**`,
      r.insufficientData ? '• ⚠ Dữ liệu lịch sử còn mỏng — kết quả mang tính tham khảo.' : null,
      `→ **DSS → Dự báo nhu cầu** để chỉnh kỳ.`,
    ]
      .filter(Boolean)
      .join('\n')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'API không phản hồi'
    return [
      `• Chưa lấy được dự báo từ dữ liệu thật cho **${focus.name}**: ${msg}`,
      `• Cần đơn **DELIVERED** đủ cửa sổ lịch sử — mở **DSS → Dự báo nhu cầu**.`,
    ].join('\n')
  }
}

export async function priceBriefLive(catalog: Product[]): Promise<string> {
  const focus = pickFocusProduct(catalog)
  if (!focus?.id || !/^\d+$/.test(focus.id)) return priceBrief(catalog)
  try {
    const { dssApi } = await import('@/api/services')
    const r = await dssApi.recommendPrice(focus.id, 30)
    return [
      `• Nguồn: **API DSS khuyến nghị giá**`,
      `• SP: **${r.productName || focus.name}**`,
      `• Giá hiện tại: **${formatVnd(Number(r.currentPrice))}** → đề xuất **${formatVnd(Number(r.recommendedPrice))}** (${r.priceChangePct > 0 ? '+' : ''}${r.priceChangePct}%)`,
      `• Hành động: **${r.action}**`,
      r.message ? `• ${r.message}` : null,
      r.insight ? `• ${r.insight}` : null,
      `→ **DSS → Khuyến nghị giá**.`,
    ]
      .filter(Boolean)
      .join('\n')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'API không phản hồi'
    return [
      `• Chưa lấy được gợi ý giá từ API cho **${focus.name}**: ${msg}`,
      `• Cần lịch sử giá / bán thật — mở **DSS → Khuyến nghị giá**.`,
    ].join('\n')
  }
}

export async function inventoryDssBriefLive(catalog: Product[]): Promise<string> {
  try {
    const { dssApi } = await import('@/api/services')
    const api = await dssApi.recommendInventory(14)
    const need = (api.rows ?? []).filter((r) => r.status === 'need' || r.recommendedOrder > 0)
    const lines = [
      `• Nguồn: **API DSS tồn kho**`,
      `• ${api.recommendationMessage}`,
      `• Trạng thái tổng: **${api.overallStatus}**`,
    ]
    if (need.length) {
      lines.push('**Cần bổ sung:**')
      for (const r of need.slice(0, 4)) {
        lines.push(
          `• ${r.productName}: tồn ${r.currentStock} · ROP ${r.reorderPoint} · nhập **${r.recommendedOrder}**`,
        )
      }
    }
    lines.push('→ **DSS → Khuyến nghị tồn kho**.')
    return lines.join('\n')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'API không phản hồi'
    return [`• API tồn kho chưa trả được khuyến nghị: ${msg}`, inventoryDssBrief(catalog)].join(
      '\n',
    )
  }
}

export async function sellerWhatIfBriefLive(
  discountPct: number,
  catalog: Product[],
): Promise<string> {
  const focus = pickFocusProduct(catalog)
  if (!focus?.id || !/^\d+$/.test(focus.id)) return sellerWhatIfBrief(discountPct)
  try {
    const { dssApi } = await import('@/api/services')
    const r = await dssApi.analyzeSellerWhatIf({
      productId: Number(focus.id),
      priceChangePercent: -Math.abs(discountPct),
      simulationPeriod: 30,
    })
    return [
      `• Nguồn: **API What-if seller**`,
      `• SP: **${focus.name}** · Giảm **${discountPct}%** · 30 ngày`,
      `• Giá: ${formatVnd(r.currentPrice)} → **${formatVnd(r.newPrice)}**`,
      `• Nhu cầu: ${r.forecastDemand} → **${r.predictedDemand}**`,
      `• LN: ${formatVnd(r.currentProfit)} → **${formatVnd(r.expectedProfit)}**`,
      r.businessInsight ? `• ${r.businessInsight}` : null,
      `→ **/seller/dss/what-if**`,
    ]
      .filter(Boolean)
      .join('\n')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'API không phản hồi'
    return [
      `• Chưa chạy được what-if cho **${focus.name}**: ${msg}`,
      `• Cần chạy **Dự báo nhu cầu** + **Khuyến nghị giá** trước (dữ liệu DELIVERED).`,
      `→ **/seller/dss/what-if**`,
    ].join('\n')
  }
}

export function managerWhatIfBrief(_discountHint = 10): string {
  return [
    '• What-if giảm giá theo **sản phẩm** thuộc module **Người bán**.',
    '• Manager dùng **Doanh thu sàn** + **Looker Studio** để theo dõi GMV toàn sàn.',
    '→ Seller: **/seller/dss/what-if** · Manager: **/manager/dashboard**.',
  ].join('\n')
}

/** Parse % giảm giá từ câu hỏi (vd: giảm 10%, what-if 15) */
export function extractDiscountPct(raw: string, fallback = 10): number {
  const m =
    raw.match(/(\d{1,2})\s*%/) ??
    raw.match(/(?:giam|discount)\s*(?:gia\s*)?(\d{1,2})/i) ??
    raw.match(/what-?\s*if\s*(\d{1,2})/i)
  if (!m) return fallback
  const n = Number(m[1])
  if (Number.isNaN(n) || n < 1 || n > 50) return fallback
  return n
}
