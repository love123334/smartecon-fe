/** Mock engine — Price recommendation DSS (FE demo) */

export interface PriceProductOption {
  id: string
  name: string
  currentPrice: number
}

export const PRICE_PRODUCTS: PriceProductOption[] = [
  { id: '1', name: 'Tai nghe Bluetooth Pro ANC', currentPrice: 1_890_000 },
  { id: '2', name: 'Bàn phím cơ RGB KeyPro K87', currentPrice: 2_450_000 },
  { id: 'p100', name: 'Demo Widget Pro (USD mock)', currentPrice: 100 },
  { id: '4', name: 'Nồi chiên không dầu 5L', currentPrice: 1_290_000 },
]

export interface PriceHistoryRow {
  date: string
  averagePrice: number
  quantitySold: number
  elasticity: number
}

export interface PriceChartPoint {
  label: string
  averagePrice: number
  quantitySold: number
}

export interface PriceRecommendationResult {
  productName: string
  currentPrice: number
  recommendedPrice: number
  priceChangePct: number
  priceElasticity: number
  currentDemand: number
  predictedDemand: number
  expectedRevenue: number
  recommendationAction: 'increase' | 'decrease' | 'keep'
  recommendationMessage: string
  insightTitle: string
  insightBody: string
  history: PriceHistoryRow[]
  chart: PriceChartPoint[]
}

function formatVnd(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫'
}

export function generatePriceRecommendation(input: {
  product: PriceProductOption
  fromDate: string
  toDate: string
}): PriceRecommendationResult {
  const current = input.product.currentPrice
  // Spec-aligned mock for demo product $100
  const isUsdDemo = input.product.id === 'p100'
  const elasticity = -1.25
  const priceChangePct = 5
  const recommended = Math.round(current * (1 + priceChangePct / 100))
  const currentDemand = isUsdDemo ? 200 : 180
  const predictedDemand = Math.round(currentDemand * (1 + elasticity * (priceChangePct / 100)))
  const expectedRevenue = recommended * predictedDemand

  const chart: PriceChartPoint[] = []
  const history: PriceHistoryRow[] = []
  const baseQty = currentDemand
  for (let i = 9; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 3)
    const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    const priceWobble = 1 + ((i % 4) - 1.5) * 0.02
    const avgPrice = Math.round(current * priceWobble)
    const qty = Math.max(80, Math.round(baseQty * (1.15 - (avgPrice / current - 1) * 1.2) + (i % 3) * 4))
    chart.push({ label, averagePrice: avgPrice, quantitySold: qty })
    history.push({
      date: d.toISOString().slice(0, 10),
      averagePrice: avgPrice,
      quantitySold: qty,
      elasticity: Math.round((elasticity + (i % 5) * 0.03) * 100) / 100,
    })
  }

  const recommendationMessage = isUsdDemo
    ? `Sản phẩm có nhu cầu tương đối kém co giãn (Elasticity = ${elasticity}). Tăng giá ${priceChangePct}% dự kiến giảm nhẹ nhu cầu nhưng tăng tổng doanh thu. DSS khuyến nghị điều chỉnh giá bán lên $${recommended}.`
    : `Sản phẩm có nhu cầu tương đối kém co giãn (Elasticity = ${elasticity}). Tăng giá ${priceChangePct}% dự kiến giảm nhẹ nhu cầu nhưng tăng tổng doanh thu. DSS khuyến nghị điều chỉnh giá bán lên ${formatVnd(recommended)}.`

  return {
    productName: input.product.name,
    currentPrice: current,
    recommendedPrice: recommended,
    priceChangePct,
    priceElasticity: elasticity,
    currentDemand,
    predictedDemand,
    expectedRevenue,
    recommendationAction: 'increase',
    recommendationMessage,
    insightTitle: 'Nên tăng giá bán',
    insightBody: isUsdDemo
      ? `Nên tăng giá ${priceChangePct}% vì doanh thu kỳ vọng tăng trong khi mức giảm nhu cầu vẫn chấp nhận được.`
      : `Nên tăng giá ${priceChangePct}% vì doanh thu kỳ vọng tăng trong khi mức giảm nhu cầu vẫn chấp nhận được.`,
    history: history.reverse(),
    chart,
  }
}

/** Preload sample so dashboard never looks empty */
export function defaultPriceRecommendation(): PriceRecommendationResult {
  const product = PRICE_PRODUCTS.find((p) => p.id === '1') ?? PRICE_PRODUCTS[0]
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return generatePriceRecommendation({
    product,
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  })
}
