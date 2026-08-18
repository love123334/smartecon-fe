import type { DssInsight, Product } from '@/types'
import { formatViNumber } from '@/utils/demandPrediction'

export type SellerDssModuleKey = 'demand' | 'advanced-price' | 'whatif'
export type SellerDssAiTone = 'strong' | 'steady' | 'soft' | 'warn' | 'ok' | 'sparse'

export interface SellerDssModuleCard {
  key: SellerDssModuleKey
  to: string
  tag: string
  title: string
  blurb: string
  badge: string
  tone: SellerDssAiTone
  summary: string
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

/** 3 card hub DSS — 3 chức năng chính theo số liệu seller thật (catalog + insights). */
export function buildSellerDssModuleCards(input: {
  insights: InsightLike[]
  products: ProductLike[]
}): SellerDssModuleCard[] {
  const count = input.products?.length ?? 0
  const totalInsights = input.insights?.length ?? 0
  const top = [...(input.products ?? [])].sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))[0] ?? null
  const topName = top?.name?.trim() || 'sản phẩm đang bán'

  return [
    {
      key: 'demand',
      to: '/seller/dss/demand-lightgbm-demo',
      tag: 'Dữ liệu bán',
      title: 'Dự báo Nhu cầu',
      blurb: 'Xem xu hướng bán theo lịch sử và chọn khoảng thời gian để ước lượng nhu cầu.',
      badge: count > 0 ? 'Mở chức năng' : 'Bắt đầu từ catalog',
      tone: count > 0 ? 'steady' : 'soft',
      summary: count > 0
        ? `Có ${formatViNumber(count)} sản phẩm trong catalog. Ưu tiên chạy dự báo cho ${topName} để kiểm tra nhịp bán và kế hoạch nhập hàng.`
        : 'Thêm sản phẩm trước, sau đó chạy Dự báo Nhu cầu để xem xu hướng bán.',
    },
    {
      key: 'advanced-price',
      to: '/seller/dss/advanced-price',
      tag: 'Giá bán',
      title: 'Gợi ý Giá bán',
      blurb: 'So sánh các mức giá, biên lợi nhuận và tác động tới doanh thu trước khi quyết định.',
      badge: totalInsights > 0 ? 'Có dữ liệu phân tích' : 'Thiết lập kịch bản',
      tone: totalInsights > 0 ? 'steady' : 'soft',
      summary: totalInsights > 0
        ? `Hệ thống đang có ${formatViNumber(totalInsights)} tín hiệu vận hành. Dùng Gợi ý Giá bán để đánh giá mức giá phù hợp cho từng sản phẩm.`
        : 'Tạo kịch bản giá bán để xem thay đổi giá ảnh hưởng thế nào đến doanh thu và lợi nhuận.',
    },
    {
      key: 'whatif',
      to: '/seller/dss/order-economics',
      tag: 'Kịch bản',
      title: 'What-if Hiệu suất',
      blurb: 'Mô phỏng phí, khuyến mãi và chi phí để xem hiệu suất đơn hàng thay đổi ra sao.',
      badge: count > 0 ? 'Thử kịch bản' : 'Chuẩn bị dữ liệu',
      tone: count > 0 ? 'ok' : 'soft',
      summary: count > 0
        ? `Chọn một sản phẩm đang bán để kiểm tra các kịch bản hiệu suất đơn hàng trước khi áp dụng thật.`
        : 'Có dữ liệu đơn hàng rồi hãy chạy What-if Hiệu suất để so sánh các phương án kinh doanh.',
    },
  ]
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
        ? `${name}: Khuyến nghị tăng ${formatViNumber(pct)}% sẽ đạt lợi nhuận kỳ vọng cao hơn.`
        : pct < -2
          ? `${name}: Khuyến nghị giảm ${formatViNumber(Math.abs(pct))}% để cải thiện lợi nhuận kỳ vọng.`
          : `${name}: Giá hiện tại đã gần tối ưu — nên giữ ổn định.`,
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

/** Nhận định ngắn gọn cho What-if (gộp trong một card). */
export function buildWhatIfSystemJudgment(input: {
  discountPercentage: number
  currentProfit: number
  expectedProfit: number
}): string {
  const pct = formatViNumber(input.discountPercentage)
  const delta = Number(input.expectedProfit) - Number(input.currentProfit)
  if (delta < 0) {
    return `Nhận định từ Hệ thống: Mức giảm ${pct}% mà bạn mong muốn có thể làm giảm lợi nhuận kinh doanh nếu không đạt được doanh số sản phẩm theo dự đoán.`
  }
  if (delta > 0) {
    return `Nhận định từ Hệ thống: Mức giảm ${pct}% có thể cải thiện lợi nhuận nếu đạt được doanh số sản phẩm theo dự đoán.`
  }
  return `Nhận định từ Hệ thống: Mức giảm ${pct}% giữ lợi nhuận gần như ổn định — cần theo dõi doanh số thực tế.`
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
