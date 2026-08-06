import type { DssInsight, Product } from '@/types'
import { formatViNumber } from '@/utils/demandPrediction'

export type SellerDssModuleKey = 'demand' | 'price' | 'inventory' | 'whatif'
export type SellerDssAiTone = 'strong' | 'steady' | 'soft' | 'warn' | 'ok'

export interface SellerDssModuleCard {
  key: SellerDssModuleKey
  to: string
  tag: string
  title: string
  blurb: string
  aiBadge: string
  aiTone: SellerDssAiTone
  aiTitle: string
  aiSummary: string
}

export interface StructuredAiInsight {
  tone: SellerDssAiTone
  badge: string
  title: string
  summary: string
  actions: string[]
  risks: string[]
}

type InsightLike = Pick<DssInsight, 'title' | 'description' | 'impact' | 'category'>
type ProductLike = Pick<Product, 'name' | 'stock' | 'soldCount' | 'price' | 'rating'>

function catalogSignals(products: ProductLike[]) {
  const list = products ?? []
  const lowStock = list.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) < 20)
  const outOfStock = list.filter((p) => (p.stock ?? 0) <= 0)
  const top = [...list].sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))[0] ?? null
  const avgSold =
    list.length > 0 ? list.reduce((s, p) => s + (p.soldCount ?? 0), 0) / list.length : 0
  const highImpactInv = 0 // filled by caller via insights
  return { list, lowStock, outOfStock, top, avgSold, highImpactInv }
}

/** 4 card hub DSS — nhận định AI theo số liệu seller thật (catalog + insights). */
export function buildSellerDssModuleCards(input: {
  insights: InsightLike[]
  products: ProductLike[]
}): SellerDssModuleCard[] {
  const insights = input.insights ?? []
  const { list, lowStock, outOfStock, top, avgSold } = catalogSignals(input.products)
  const invInsights = insights.filter(
    (i) => /inventory|tồn|stock|nhập/i.test(`${i.category} ${i.title} ${i.description}`),
  )
  const highInv = invInsights.filter((i) => i.impact === 'high').length
  const priceHints = insights.filter((i) =>
    /giá|price|elasticity|biên|lợi nhuận|margin/i.test(`${i.title} ${i.description}`),
  )
  const topName = top?.name?.trim() || 'SKU bán chạy'
  const topSold = top?.soldCount ?? 0
  const skuCount = list.length

  const demandTone: SellerDssAiTone =
    topSold >= 80 || avgSold >= 40 ? 'strong' : topSold >= 20 || avgSold >= 10 ? 'steady' : 'soft'
  const demand: SellerDssModuleCard = {
    key: 'demand',
    to: '/seller/dss/demand',
    tag: 'Dự báo',
    title: 'Dự báo nhu cầu',
    blurb: 'Moving Average từ lịch sử bán · KPI & biểu đồ.',
    aiBadge: demandTone === 'strong' ? 'Cầu mạnh' : demandTone === 'steady' ? 'Ổn định' : 'Cần kích cầu',
    aiTone: demandTone,
    aiTitle:
      demandTone === 'strong'
        ? `${topName} đang dẫn cầu shop`
        : demandTone === 'steady'
          ? 'Nhịp bán đều — nên khóa dự báo MA'
          : skuCount
            ? 'Cầu còn mỏng — dự báo trước khi nhập lớn'
            : 'Chưa đủ SP để đọc tín hiệu cầu',
    aiSummary:
      skuCount === 0
        ? 'Chưa có sản phẩm trong catalog seller. Thêm SP rồi chạy dự báo nhu cầu.'
        : demandTone === 'strong'
          ? `${topName} đã bán ~${formatViNumber(topSold)} · TB shop ~${formatViNumber(avgSold)}/SKU. Ưu tiên dự báo 30 ngày để khóa kế hoạch nhập.`
          : demandTone === 'steady'
            ? `Có ${skuCount} SKU · đầu bảng ${topName} (~${formatViNumber(topSold)} lượt). Chạy MA 60–90 ngày để ổn định tồn.`
            : `${topName} mới ~${formatViNumber(topSold)} lượt bán. Dự báo MA trước, tránh nhập oversized.`,
  }

  const priceTone: SellerDssAiTone = priceHints.length
    ? 'warn'
    : topSold >= 40
      ? 'steady'
      : 'soft'
  const price: SellerDssModuleCard = {
    key: 'price',
    to: '/seller/dss/price',
    tag: 'Giá bán',
    title: 'Gợi ý giá',
    blurb: 'Hệ số co giãn · kịch bản · khuyến nghị tốt nhất.',
    aiBadge: priceTone === 'warn' ? 'Cần xem giá' : priceTone === 'steady' ? 'Tối ưu biên' : 'Khám phá',
    aiTone: priceTone,
    aiTitle: priceHints[0]?.title || (top ? `Rà giá cho ${topName}` : 'Chưa có tín hiệu giá'),
    aiSummary: priceHints[0]
      ? priceHints[0].description || 'Dashboard đang cảnh báo liên quan biên/giá — mở Gợi ý giá để chạy kịch bản.'
      : top
        ? `${topName} giá hiện ~${formatViNumber(top.price)}đ · rating ${formatViNumber(top.rating)}. Chạy hệ số co giãn để chọn % đổi giá tối ưu lợi nhuận.`
        : 'Thêm sản phẩm có lịch sử bán rồi tạo khuyến nghị giá.',
  }

  const needCount = Math.max(lowStock.length + outOfStock.length, highInv, invInsights.length)
  const invTone: SellerDssAiTone =
    outOfStock.length || highInv ? 'warn' : lowStock.length ? 'soft' : skuCount ? 'ok' : 'soft'
  const inventory: SellerDssModuleCard = {
    key: 'inventory',
    to: '/seller/dss/inventory',
    tag: 'Tồn kho',
    title: 'Khuyến nghị tồn kho',
    blurb: 'ROP · safety stock · SL nhập theo kỳ.',
    aiBadge:
      outOfStock.length || highInv
        ? 'Ưu tiên nhập'
        : lowStock.length
          ? 'Sắp hết'
          : 'Tồn ổn',
    aiTone: invTone,
    aiTitle:
      outOfStock.length > 0
        ? `${outOfStock.length} SKU hết hàng`
        : lowStock.length > 0
          ? `${lowStock.length} SKU dưới ngưỡng an toàn`
          : invInsights[0]?.title || 'Tồn đang trong vùng an toàn',
    aiSummary:
      needCount > 0
        ? `${outOfStock.length ? `${outOfStock.length} hết hàng · ` : ''}${lowStock.length ? `${lowStock.length} sắp hết · ` : ''}${
            invInsights[0]?.description || 'Mở khuyến nghị tồn để tính ROP và SL nhập.'
          }`
        : skuCount
          ? `Theo dõi ${skuCount} SKU — chạy khuyến nghị 14 ngày để đối chiếu ROP.`
          : 'Chưa có SP để tính tồn. Thêm hàng tại Quản lý sản phẩm.',
  }

  const promoTone: SellerDssAiTone =
    demandTone === 'soft' || lowStock.length === 0 && topSold < 30
      ? 'soft'
      : demandTone === 'strong' && lowStock.length
        ? 'warn'
        : 'steady'
  const whatif: SellerDssModuleCard = {
    key: 'whatif',
    to: '/seller/dss/what-if',
    tag: 'What-if',
    title: 'Giảm giá & lợi nhuận',
    blurb: 'Mô phỏng % giảm · hòa vốn · lợi nhuận kỳ vọng.',
    aiBadge:
      promoTone === 'warn' ? 'Cẩn thận KM' : promoTone === 'soft' ? 'Thử kích cầu' : 'Mô phỏng trước',
    aiTone: promoTone,
    aiTitle:
      promoTone === 'warn'
        ? 'Cầu mạnh nhưng tồn mỏng — đừng KM sâu'
        : promoTone === 'soft'
          ? 'Cầu yếu — What-if 5–10% trước khi giảm thật'
          : 'Mô phỏng biên lợi nhuận trước khuyến mãi',
    aiSummary:
      promoTone === 'warn'
        ? `${topName} bán tốt nhưng còn SKU tồn thấp. What-if để tránh KM khi thiếu hàng.`
        : promoTone === 'soft'
          ? `Nhịp bán còn thấp — mô phỏng giảm nhẹ xem lợi nhuận kỳ vọng còn dương trước khi áp dụng.`
          : `Dùng What-if để so sánh lợi nhuận hiện tại vs sau giảm giá trên ${topName}.`,
  }

  return [demand, price, inventory, whatif]
}

/** Nhận định AI sau khi có kết quả Gợi ý giá. */
export function buildPricePredictionAiInsight(input: {
  productName: string
  currentPrice: number
  cost: number
  averageElasticity: number
  totalQuantitySold: number
  best?: {
    priceChangePercent: number
    newPrice: number
    expectedProfit: number
    predictedDemand: number
    profitPerProduct: number
  } | null
}): StructuredAiInsight {
  const name = input.productName || 'Sản phẩm'
  const e = Number(input.averageElasticity)
  const best = input.best
  if (!best) {
    return {
      tone: 'soft',
      badge: 'Thiếu kịch bản',
      title: `${name}: chưa chọn được kịch bản tối ưu`,
      summary:
        'Hệ thống chưa trả kịch bản tốt nhất. Kiểm tra khoảng ngày có đủ đơn bán, rồi tạo lại.',
      actions: ['Nới khoảng từ ngày–đến ngày', 'Chọn sản phẩm có lịch sử bán rõ', 'Đối chiếu bảng doanh số'],
      risks: ['Đổi giá khi thiếu hệ số co giãn dễ lệch cầu thực tế.'],
    }
  }
  const pct = Number(best.priceChangePercent)
  const tone: SellerDssAiTone = pct > 2 ? 'strong' : pct < -2 ? 'warn' : 'steady'
  return {
    tone,
    badge: pct > 2 ? 'Nên tăng giá' : pct < -2 ? 'Nên giảm giá' : 'Giữ quanh giá hiện tại',
    title:
      pct > 2
        ? `${name}: tăng ~${formatViNumber(pct)}% có lợi nhuận kỳ vọng cao hơn`
        : pct < -2
          ? `${name}: giảm ~${formatViNumber(Math.abs(pct))}% để kéo cầu`
          : `${name}: giá hiện tại đã gần tối ưu`,
    summary: `Hệ số co giãn ${formatViNumber(e)} · đã bán ${formatViNumber(input.totalQuantitySold)} sp. Kịch bản tốt nhất: giá mới ${formatViNumber(best.newPrice)}đ · cầu dự kiến ${formatViNumber(best.predictedDemand)} · LN/sp ${formatViNumber(best.profitPerProduct)}đ · LN kỳ vọng ${formatViNumber(best.expectedProfit)}đ.`,
    actions: [
      pct < -2
        ? 'Mô phỏng thêm trên What-if trước khi chạy KM thật.'
        : 'Áp dụng thay đổi giá có kiểm soát trên Quản lý SP.',
      'Theo dõi đơn 7 ngày sau đổi giá.',
      'Đối chiếu lại Gợi ý giá sau chu kỳ bán mới.',
    ],
    risks: [
      Math.abs(e) < 0.2
        ? 'Hệ số co giãn gần 0 — mẫu dữ liệu có thể mỏng, đừng đổi giá quá mạnh.'
        : 'Cầu thực tế có thể lệch kịch bản nếu có flash sale sàn.',
      best.profitPerProduct <= 0
        ? 'LN/sp ≤ 0 — không nên theo kịch bản này.'
        : 'Lead time / tồn mỏng có thể làm mất doanh thu khi cầu tăng.',
    ],
  }
}

/** Nhận định AI sau khuyến nghị tồn. */
export function buildInventoryAiInsight(input: {
  focusProductName: string
  overallStatus: string
  recommendationMessage: string
  currentStock: number
  reorderPoint: number
  recommendedOrderQuantity: number
  averageDailyDemand: number
  needRowCount: number
}): StructuredAiInsight {
  const need = String(input.overallStatus).toLowerCase() === 'need' || input.needRowCount > 0
  const name = input.focusProductName || 'SKU trọng tâm'
  return {
    tone: need ? 'warn' : 'ok',
    badge: need ? 'Cần nhập hàng' : 'Tồn đủ',
    title: need
      ? `${name}: tồn dưới điểm đặt hàng lại`
      : `${name}: tồn trong vùng an toàn`,
    summary:
      (input.recommendationMessage?.trim() ||
        (need
          ? `Tồn ${formatViNumber(input.currentStock)} < ROP ${formatViNumber(input.reorderPoint)}. Đề xuất nhập ${formatViNumber(input.recommendedOrderQuantity)}.`
          : `Tồn ${formatViNumber(input.currentStock)} · ROP ${formatViNumber(input.reorderPoint)} · nhu cầu TB ${formatViNumber(input.averageDailyDemand)}/ngày.`)) +
      (input.needRowCount > 1 ? ` Có ${input.needRowCount} SKU cần nhập.` : ''),
    actions: need
      ? [
          `Lên PO khoảng ${formatViNumber(input.recommendedOrderQuantity)} đơn vị cho ${name}.`,
          'Chạy Dự báo nhu cầu để khớp kỳ nhập.',
          'Ưu tiên SKU status = need trước khi KM.',
        ]
      : [
          'Duy trì theo dõi ROP hàng tuần.',
          'Dùng What-if nếu muốn đẩy bán tồn chậm.',
          'Rà lại khuyến nghị sau đợt bán mạnh.',
        ],
    risks: need
      ? ['Hết hàng làm mất ranking và doanh thu.', 'Lead time dài hơn dự kiến khoét buffer safety stock.']
      : ['Tồn quá dày làm ứ vốn nếu cầu giảm đột ngột.', 'Đơn vị nhu cầu TB đổi nhanh khi có KM.'],
  }
}

/** Bổ sung nhận định AI cho What-if (khi businessInsight mỏng). */
export function buildWhatIfAiInsight(input: {
  productName?: string
  discountPercentage: number
  currentProfit: number
  expectedProfit: number
  breakEvenQuantity: number
  additionalUnitsRequired: number
  predictedDemand: number
  businessInsight?: string
}): StructuredAiInsight {
  const delta = Number(input.expectedProfit) - Number(input.currentProfit)
  const tone: SellerDssAiTone = delta > 0 ? 'strong' : delta < 0 ? 'warn' : 'steady'
  const name = input.productName?.trim() || 'Sản phẩm'
  const backend = input.businessInsight?.trim()
  return {
    tone,
    badge: delta > 0 ? 'LN tăng' : delta < 0 ? 'LN giảm' : 'LN tương đương',
    title:
      delta > 0
        ? `${name}: giảm ${formatViNumber(input.discountPercentage)}% vẫn cải thiện lợi nhuận kỳ vọng`
        : delta < 0
          ? `${name}: mức giảm ${formatViNumber(input.discountPercentage)}% làm mỏng lợi nhuận`
          : `${name}: lợi nhuận gần như không đổi ở mức giảm này`,
    summary:
      backend && backend.length > 40
        ? backend
        : `LN hiện ${formatViNumber(input.currentProfit)}đ → kỳ vọng ${formatViNumber(input.expectedProfit)}đ. Cần thêm ~${formatViNumber(input.additionalUnitsRequired)} đơn vị so với hòa vốn ${formatViNumber(input.breakEvenQuantity)} (cầu dự kiến ${formatViNumber(input.predictedDemand)}).`,
    actions:
      delta >= 0
        ? [
            'Có thể thử KM có kiểm soát nếu tồn đủ.',
            'Đối chiếu Gợi ý giá để không cắt biên quá sâu.',
            'Theo dõi conversion 3–7 ngày đầu KM.',
          ]
        : [
            'Giảm % KM hoặc rút ngắn thời gian chạy.',
            'Chỉ áp dụng nếu mục tiêu là xả tồn / lấy traffic.',
            'Chạy lại What-if với 5% trước khi quyết định.',
          ],
    risks: [
      input.additionalUnitsRequired > input.predictedDemand
        ? 'Khó đạt hòa vốn với cầu dự kiến hiện tại.'
        : 'Cầu thực tế có thể thấp hơn mô phỏng.',
      'Tồn không đủ sẽ làm mất doanh thu khi KM hút cầu.',
    ],
  }
}
