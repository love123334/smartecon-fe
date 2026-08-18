export const ORDER_ECONOMICS_DEFAULTS = Object.freeze({
  packagingCost: 4_000,
  platformFeePercent: 12,
  affiliatePercent: 8,
  adsPerOrder: 12_000,
  refundReservePercent: 2,
})

export type OrderEconomicsDecision = 'SCALE' | 'TEST' | 'FIX'

export interface OrderEconomicsInput {
  price: number
  costPrice: number
  packagingCost: number
  platformFeePercent: number
  affiliatePercent: number
  adsPerOrder: number
  refundReservePercent: number
}

export interface OrderEconomicsResult {
  platformFeeAmount: number
  affiliateFeeAmount: number
  refundReserveAmount: number
  totalRateCost: number
  preAdsContribution: number
  contributionPerOrder: number
  contributionMarginPercent: number
  breakEvenAdsPerOrder: number
  decision: OrderEconomicsDecision
}

export interface OrderEconomicsErrors {
  price?: string
  costPrice?: string
  packagingCost?: string
  platformFeePercent?: string
  affiliatePercent?: string
  adsPerOrder?: string
  refundReservePercent?: string
}

export function validateOrderEconomicsInput(input: OrderEconomicsInput): OrderEconomicsErrors {
  const errors: OrderEconomicsErrors = {}
  if (!Number.isFinite(input.price) || input.price <= 0) {
    errors.price = 'Giá bán trong cơ sở dữ liệu phải lớn hơn 0.'
  }
  if (!Number.isFinite(input.costPrice) || input.costPrice < 0) {
    errors.costPrice = 'Sản phẩm chưa có giá vốn hợp lệ trong cơ sở dữ liệu.'
  }

  const moneyFields = [
    ['packagingCost', input.packagingCost, 'Chi phí đóng gói'],
    ['adsPerOrder', input.adsPerOrder, 'Chi phí quảng cáo mỗi đơn'],
  ] as const
  for (const [field, value, label] of moneyFields) {
    if (!Number.isFinite(value) || value < 0) errors[field] = `${label} phải từ 0 trở lên.`
  }

  const percentFields = [
    ['platformFeePercent', input.platformFeePercent, 'Phí nền tảng'],
    ['affiliatePercent', input.affiliatePercent, 'Phí tiếp thị liên kết'],
    ['refundReservePercent', input.refundReservePercent, 'Dự phòng hoàn trả'],
  ] as const
  for (const [field, value, label] of percentFields) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      errors[field] = `${label} phải nằm trong khoảng 0–100%.`
    }
  }
  return errors
}

export function calculateOrderEconomics(input: OrderEconomicsInput): OrderEconomicsResult {
  const platformFeeAmount = input.price * (input.platformFeePercent / 100)
  const affiliateFeeAmount = input.price * (input.affiliatePercent / 100)
  const refundReserveAmount = input.price * (input.refundReservePercent / 100)
  const totalRateCost = platformFeeAmount + affiliateFeeAmount + refundReserveAmount
  const preAdsContribution = input.price - input.costPrice - input.packagingCost - totalRateCost
  const contributionPerOrder = preAdsContribution - input.adsPerOrder
  const contributionMarginPercent = input.price
    ? (contributionPerOrder / input.price) * 100
    : 0
  const decision: OrderEconomicsDecision =
    contributionMarginPercent >= 15 ? 'SCALE' : contributionMarginPercent > 0 ? 'TEST' : 'FIX'

  return {
    platformFeeAmount,
    affiliateFeeAmount,
    refundReserveAmount,
    totalRateCost,
    preAdsContribution,
    contributionPerOrder,
    contributionMarginPercent,
    breakEvenAdsPerOrder: Math.max(0, preAdsContribution),
    decision,
  }
}

export function formatOrderEconomicsVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function formatOrderEconomicsPercent(value: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Number(value) || 0)}%`
}
