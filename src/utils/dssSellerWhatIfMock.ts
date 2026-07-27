/** Mock DSS — What-if Analysis: Discount Profit Analysis (Seller) */

export interface WhatIfProduct {
  id: string
  name: string
  currentPrice: number
  unitCost: number
  forecastDemand: number
  monthlyProfit: number
}

export const WHATIF_PRODUCTS: WhatIfProduct[] = [
  {
    id: 'coffee',
    name: 'Cà phê hạt Premium 500g',
    currentPrice: 20,
    unitCost: 12,
    forecastDemand: 100,
    monthlyProfit: 800,
  },
  {
    id: 'headphones',
    name: 'Tai nghe Bluetooth Pro ANC',
    currentPrice: 45,
    unitCost: 28,
    forecastDemand: 80,
    monthlyProfit: 1360,
  },
  {
    id: 'keyboard',
    name: 'Bàn phím cơ RGB KeyPro K87',
    currentPrice: 32,
    unitCost: 18,
    forecastDemand: 60,
    monthlyProfit: 840,
  },
]

export const SIM_PERIOD_OPTIONS = [
  { value: '7' as const, label: '7 ngày', days: 7 },
  { value: '30' as const, label: '30 ngày', days: 30 },
  { value: '90' as const, label: '90 ngày', days: 90 },
]

export type SimPeriodKey = (typeof SIM_PERIOD_OPTIONS)[number]['value']

export interface BreakEvenCurvePoint {
  discountPct: number
  breakEvenQty: number
}

export interface SellerWhatIfResult {
  productName: string
  periodLabel: string
  discountPct: number
  currentPrice: number
  unitCost: number
  currentDemand: number
  currentProfit: number
  predictedNewPrice: number
  predictedDemand: number
  expectedRevenue: number
  expectedProfit: number
  breakEvenQuantity: number
  additionalUnitsRequired: number
  demandLiftPct: number
  insight: string
  breakEvenCurve: BreakEvenCurvePoint[]
  generatedAt: string
}

/** Spec default mock for 10% / 30 days / coffee */
export function defaultSellerWhatIf(): SellerWhatIfResult {
  return generateSellerWhatIf({
    productId: 'coffee',
    discountPct: 10,
    periodKey: '30',
  })
}

export function generateSellerWhatIf(input: {
  productId: string
  discountPct: number
  periodKey: SimPeriodKey
}): SellerWhatIfResult {
  const product = WHATIF_PRODUCTS.find((p) => p.id === input.productId) ?? WHATIF_PRODUCTS[0]
  const period = SIM_PERIOD_OPTIONS.find((p) => p.value === input.periodKey) ?? SIM_PERIOD_OPTIONS[1]
  const d = Math.min(30, Math.max(0, Math.round(input.discountPct)))

  const predictedNewPrice = +(product.currentPrice * (1 - d / 100)).toFixed(2)

  // Demand lift roughly +1.8% per discount point (coffee 10% → +18% → 118)
  const demandLiftPct = +(d * 1.8).toFixed(1)
  const predictedDemand = Math.round(product.forecastDemand * (1 + demandLiftPct / 100))

  // For coffee defaults match brief; other products use same formula
  let expectedRevenue: number
  let expectedProfit: number
  let breakEvenQuantity: number
  let additionalUnitsRequired: number
  let breakEvenCurve: BreakEvenCurvePoint[]

  if (product.id === 'coffee' && d === 10) {
    expectedRevenue = 2124
    expectedProfit = 708
    breakEvenQuantity = 125
    additionalUnitsRequired = 25
    breakEvenCurve = [
      { discountPct: 0, breakEvenQty: 100 },
      { discountPct: 5, breakEvenQty: 108 },
      { discountPct: 10, breakEvenQty: 125 },
      { discountPct: 15, breakEvenQty: 145 },
      { discountPct: 20, breakEvenQty: 170 },
      { discountPct: 25, breakEvenQty: 205 },
      { discountPct: 30, breakEvenQty: 250 },
    ]
  } else {
    const margin = predictedNewPrice - product.unitCost
    expectedRevenue = +(predictedDemand * predictedNewPrice).toFixed(0)
    expectedProfit = +(predictedDemand * margin).toFixed(0)
    breakEvenQuantity = margin > 0 ? Math.ceil(product.monthlyProfit / margin) : 999
    additionalUnitsRequired = Math.max(0, breakEvenQuantity - predictedDemand)
    breakEvenCurve = [0, 5, 10, 15, 20, 25, 30].map((pct) => {
      const price = product.currentPrice * (1 - pct / 100)
      const m = price - product.unitCost
      const qty = m > 0 ? Math.ceil(product.monthlyProfit / m) : 999
      return { discountPct: pct, breakEvenQty: qty }
    })
  }

  const insight =
    predictedDemand < breakEvenQuantity
      ? `Giảm giá ${d}% dự kiến tăng nhu cầu khoảng ${demandLiftPct}%. Tuy nhiên cần bán ít nhất ${breakEvenQuantity} đơn vị để giữ mức lợi nhuận hiện tại. Nhu cầu dự báo chỉ ${predictedDemand} đơn vị, vì vậy mức giảm giá này có thể làm giảm lợi nhuận.`
      : `Giảm giá ${d}% dự kiến tăng nhu cầu khoảng ${demandLiftPct}% (${predictedDemand} đơn vị). Điểm hòa vốn lợi nhuận là ${breakEvenQuantity} đơn vị — nhu cầu dự báo đủ để duy trì hoặc cải thiện lợi nhuận so với hiện tại.`

  return {
    productName: product.name,
    periodLabel: period.label,
    discountPct: d,
    currentPrice: product.currentPrice,
    unitCost: product.unitCost,
    currentDemand: product.forecastDemand,
    currentProfit: product.monthlyProfit,
    predictedNewPrice,
    predictedDemand,
    expectedRevenue,
    expectedProfit,
    breakEvenQuantity,
    additionalUnitsRequired,
    demandLiftPct,
    insight,
    breakEvenCurve,
    generatedAt: new Date().toLocaleString('vi-VN'),
  }
}

export function formatUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
