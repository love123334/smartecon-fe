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

/** Live DSS via backend — falls back to mock briefs if API unavailable. */
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
  } catch {
    return demandBrief(catalog)
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
  } catch {
    return priceBrief(catalog)
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
  } catch {
    return inventoryDssBrief(catalog)
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
      discountPercentage: discountPct,
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
    const msg = e instanceof Error ? e.message : ''
    if (/demand|price|elastic|du lieu|dữ liệu|prediction/i.test(msg)) {
      return [
        `• Chưa chạy được what-if cho **${focus.name}**: ${msg}`,
        `• Hãy mở **Dự báo nhu cầu** rồi **Khuyến nghị giá**, sau đó thử lại what-if.`,
        `→ **/seller/dss/what-if**`,
      ].join('\n')
    }
    return sellerWhatIfBrief(discountPct)
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
