/** Tóm tắt DSS demo cho chatbot — dùng chung engine với màn DSS seller/manager */
import { formatVnd } from '@/api/chat/match'
import type { Product } from '@/types'
import { generateDemandForecast } from '@/utils/dssDemandMock'
import {
  generateInventoryRecommendation,
  INVENTORY_ERROR_MESSAGES,
} from '@/utils/dssInventoryMock'
import { generatePriceRecommendation, type PriceProductOption } from '@/utils/dssPriceMock'
import { generateSellerWhatIf, formatUsd as formatWhatIfUsd } from '@/utils/dssSellerWhatIfMock'

function pickFocusProduct(catalog: Product[]): Product | null {
  if (!catalog.length) return null
  return [...catalog].sort((a, b) => b.soldCount - a.soldCount)[0]
}

function toPriceOption(p: Product): PriceProductOption {
  return { id: p.id, name: p.name, currentPrice: p.price }
}

export function demandBrief(catalog: Product[]): string {
  const focus = pickFocusProduct(catalog)
  const name = focus?.name ?? 'Tai nghe Bluetooth Pro ANC'
  const id = focus?.id ?? '1'
  const result = generateDemandForecast({
    productId: id,
    productName: name,
    forecastKey: '30',
    historicalKey: '90',
  })
  if (!result) {
    return `• SP **${name}**: chưa đủ dữ liệu lịch sử để dự báo.`
  }
  return [
    `• SP trọng tâm: **${result.productName}**`,
    `• Cửa sổ lịch sử: ${result.historicalWindowLabel} · Kỳ dự báo: ${result.forecastPeriodLabel}`,
    `• Nhu cầu TB/ngày: **${result.averageDailyDemand}**`,
    `• Dự báo kỳ tới: **${result.predictedDemand}** đơn vị`,
    `→ Mở **DSS → Dự báo nhu cầu** để chỉnh kỳ / SP.`,
  ].join('\n')
}

export function priceBrief(catalog: Product[]): string {
  const focus = pickFocusProduct(catalog)
  const product = focus
    ? toPriceOption(focus)
    : { id: '1', name: 'Tai nghe Bluetooth Pro ANC', currentPrice: 1_890_000 }
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  const r = generatePriceRecommendation({
    product,
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  })
  const action =
    r.recommendationAction === 'increase'
      ? 'tăng giá'
      : r.recommendationAction === 'decrease'
        ? 'giảm giá'
        : 'giữ giá'
  return [
    `• SP: **${r.productName}**`,
    `• Giá hiện tại: **${formatVnd(r.currentPrice)}** → đề xuất **${formatVnd(r.recommendedPrice)}** (${r.priceChangePct > 0 ? '+' : ''}${r.priceChangePct}%)`,
    `• Elasticity: **${r.priceElasticity}** · Nhu cầu kỳ vọng: **${r.predictedDemand}**`,
    `• Doanh thu kỳ vọng: **${formatVnd(r.expectedRevenue)}**`,
    `• Hành động: **${action}** — ${r.insightBody}`,
    `→ **DSS → Khuyến nghị giá** để xem biểu đồ.`,
  ].join('\n')
}

export function inventoryDssBrief(catalog: Product[]): string {
  const result = generateInventoryRecommendation({ productId: 'all', planningKey: '14' })
  if (!result.ok) {
    return `• ${INVENTORY_ERROR_MESSAGES[result.error]}`
  }
  const d = result.data
  const need = d.rows.filter((r) => r.status === 'need')
  const lowLive = catalog.filter((p) => p.stock > 0 && p.stock < 20).slice(0, 3)
  const lines = [
    `• Kỳ hoạch định: **${d.planningLabel}** · Trạng thái: **${d.overallStatusLabel}**`,
    `• ${d.recommendationMessage}`,
  ]
  if (need.length) {
    lines.push('**Cần bổ sung (DSS):**')
    for (const r of need.slice(0, 4)) {
      lines.push(
        `• ${r.productName}: tồn ${r.currentStock} · ROP ${r.reorderPoint} · đề xuất nhập **${r.recommendedOrder}**`,
      )
    }
  }
  if (lowLive.length) {
    lines.push('**Tồn thấp trên catalog shop:**')
    for (const p of lowLive) {
      lines.push(`• ${p.name}: còn **${p.stock}**`)
    }
  }
  lines.push('→ **DSS → Khuyến nghị tồn kho**.')
  return lines.join('\n')
}

export function sellerWhatIfBrief(discountPct = 10): string {
  const r = generateSellerWhatIf({
    productId: 'headphones',
    discountPct,
    periodKey: '30',
  })
  return [
    `• SP demo: **${r.productName}** · Giảm **${r.discountPct}%** · Kỳ **${r.periodLabel}**`,
    `• Giá mới: **${formatWhatIfUsd(r.predictedNewPrice)}** (gốc ${formatWhatIfUsd(r.currentPrice)})`,
    `• Nhu cầu: ${r.currentDemand} → **${r.predictedDemand}** (+${r.demandLiftPct}%)`,
    `• LN kỳ vọng: **${formatWhatIfUsd(r.expectedProfit)}** · Break-even qty: **${r.breakEvenQuantity}**`,
    `• Insight: ${r.insight}`,
    `→ **DSS → What-if giảm giá** (/seller/dss/what-if).`,
  ].join('\n')
}

export function managerWhatIfBrief(_discountHint = 10): string {
  return [
    '• What-if giảm giá theo **sản phẩm** thuộc module **Người bán**.',
    '• Manager dùng **Doanh thu sàn** + **Looker Studio** để theo dõi GMV toàn sàn.',
    '→ Seller: **/seller/dss/what-if** · Manager: **/manager/platform-revenue**.',
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
