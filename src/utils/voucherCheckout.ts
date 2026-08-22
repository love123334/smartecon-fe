import { apiConfig } from '@/api/config'
import type { ValidateVoucherResult, Voucher } from '@/api/real/vouchers'
import type { CartLine } from '@/api/services'
import { voucherApi } from '@/api/services'
import { localizeApiMessage } from '@/utils/apiMessage'

const PENDING_VOUCHER_KEY = 'sedsp_pending_voucher'
let pendingVoucherMemory = ''

function readPendingVoucher(): string {
  try {
    const stored = sessionStorage.getItem(PENDING_VOUCHER_KEY)
    if (stored) return stored
  } catch {
    /* private mode / tests */
  }
  return pendingVoucherMemory
}

function writePendingVoucher(code: string) {
  pendingVoucherMemory = code
  try {
    if (code) sessionStorage.setItem(PENDING_VOUCHER_KEY, code)
    else sessionStorage.removeItem(PENDING_VOUCHER_KEY)
  } catch {
    /* keep in-memory copy */
  }
}

type DemoVoucher = {
  code: string
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
  minimumOrderAmount: number
  maximumDiscountAmount?: number
  scope: 'PLATFORM' | 'SHOP'
}

const DEMO_VOUCHERS: DemoVoucher[] = [
  {
    code: 'SEDSP10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minimumOrderAmount: 200_000,
    maximumDiscountAmount: 100_000,
    scope: 'PLATFORM',
  },
  {
    code: 'SHOP50K',
    discountType: 'FIXED',
    discountValue: 50_000,
    minimumOrderAmount: 300_000,
    scope: 'SHOP',
  },
]

export type CartVoucherResult = ValidateVoucherResult & {
  /** true chỉ khi POST /vouchers/validate BE trả valid — dùng khi tạo đơn. */
  serverConfirmed?: boolean
}

/** Mã demo khi API public voucher trống — khớp seed V52. */
export function demoPublicVouchers(): Voucher[] {
  const now = new Date()
  const ends = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  return DEMO_VOUCHERS.map((v, i) => ({
    id: -1 - i,
    code: v.code,
    name: v.code === 'SEDSP10' ? 'Giảm 10% toàn sàn' : 'Shop giảm 50K',
    description:
      v.code === 'SEDSP10'
        ? 'Giảm 10%, tối đa 100.000đ — đơn từ 200.000đ'
        : 'Giảm 50.000đ cho shop SEDSP Official — đơn từ 300.000đ',
    discountType: v.discountType,
    discountValue: v.discountValue,
    scope: v.scope,
    sellerId: null,
    sellerName: v.scope === 'SHOP' ? 'SEDSP Official' : null,
    appliesTo: 'ALL_PRODUCTS',
    minimumOrderAmount: v.minimumOrderAmount,
    maximumDiscountAmount: v.maximumDiscountAmount ?? null,
    usageLimit: null,
    usedCount: 0,
    startsAt: now.toISOString(),
    endsAt: ends.toISOString(),
    isActive: true,
    productIds: [],
    requestId: null,
    createdAt: now.toISOString(),
  }))
}

export function rememberPendingVoucherCode(code: string) {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return
  writePendingVoucher(normalized)
}

export function peekPendingVoucherCode(): string {
  return readPendingVoucher().trim()
}

export function consumePendingVoucherCode(): string {
  const code = peekPendingVoucherCode()
  writePendingVoucher('')
  return code
}

export function cartProductIdsForVoucher(lines: CartLine[]): number[] {
  const ids: number[] = []
  for (const line of lines) {
    const pid = Number(line.product.id)
    if (!Number.isFinite(pid) || pid <= 0) continue
    for (let i = 0; i < line.quantity; i++) ids.push(pid)
  }
  return ids
}

/** Thông báo voucher thân thiện — không hiện lỗi tech cho khách. */
export function voucherUserMessage(raw: string | null | undefined): string {
  const msg = localizeApiMessage(raw)
  const lower = msg.toLowerCase()

  if (/mã voucher không hợp lệ|mã không hợp lệ|không áp dụng cho giỏ/i.test(msg)) {
    return 'Mã giảm giá không đúng hoặc không dùng được cho giỏ hàng này.'
  }
  if (/chưa đạt giá trị tối thiểu|minimum/i.test(lower)) {
    return 'Đơn hàng chưa đủ điều kiện áp dụng mã này.'
  }
  if (/hết hạn|expired/i.test(lower)) {
    return 'Mã giảm giá đã hết hạn.'
  }
  if (/hết lượt|usage/i.test(lower)) {
    return 'Mã giảm giá đã hết lượt sử dụng.'
  }
  if (/vô hiệu|inactive|disabled/i.test(lower)) {
    return 'Mã giảm giá hiện không còn hiệu lực.'
  }
  if (/giỏ hàng trống|empty cart/i.test(lower)) {
    return 'Thêm sản phẩm vào giỏ trước khi dùng mã giảm giá.'
  }
  if (/áp dụng voucher thành công|áp dụng thành công/i.test(msg)) {
    return msg
  }
  if (/chưa xác nhận|server chưa/i.test(msg)) {
    return msg
  }
  if (/chưa áp dụng được mã|thử lại/i.test(msg)) {
    return 'Mã giảm giá tạm thời không dùng được. Bạn vẫn thanh toán bình thường — thử lại mã sau.'
  }
  if (/rollback-only|transaction silently rolled back|marked as rollback/i.test(lower)) {
    return 'Mã giảm giá tạm thời không dùng được. Bạn vẫn thanh toán bình thường — thử lại sau 1–2 phút.'
  }
  if (/backend|schema|migrate|dss\/|sql|exception|timeout|railway|vercel|vite_/i.test(msg)) {
    return 'Mã giảm giá tạm thời không dùng được. Bạn vẫn thanh toán bình thường — thử lại mã sau.'
  }

  return msg.length > 120
    ? 'Không áp dụng được mã giảm giá. Bạn vẫn thanh toán bình thường.'
    : msg
}

function demoVoucherFallback(
  code: string,
  cartSubtotal: number,
  singleSellerId: string | null,
): CartVoucherResult | null {
  const normalized = code.trim().toUpperCase()
  const demo = DEMO_VOUCHERS.find((v) => v.code === normalized)
  if (!demo) return null

  if (cartSubtotal < demo.minimumOrderAmount) {
    return {
      valid: false,
      message: 'Đơn hàng chưa đủ điều kiện áp dụng mã này.',
      serverConfirmed: false,
    }
  }

  if (demo.scope === 'SHOP' && !singleSellerId) {
    return {
      valid: false,
      message: 'Mã shop chỉ dùng khi giỏ hàng có sản phẩm từ một shop.',
      serverConfirmed: false,
    }
  }

  let discount =
    demo.discountType === 'PERCENTAGE'
      ? Math.round(cartSubtotal * (demo.discountValue / 100))
      : demo.discountValue

  if (demo.maximumDiscountAmount != null) {
    discount = Math.min(discount, demo.maximumDiscountAmount)
  }
  discount = Math.min(discount, cartSubtotal)
  if (discount <= 0) {
    return { valid: false, message: 'Mã giảm giá không áp dụng được cho giỏ hàng này.', serverConfirmed: false }
  }

  return {
    valid: true,
    serverConfirmed: true,
    code: demo.code,
    name: demo.code,
    message: 'Áp dụng mã giảm giá thành công.',
    discountType: demo.discountType,
    discountValue: demo.discountValue,
    scope: demo.scope,
    discountAmount: discount,
    eligibleSubtotal: cartSubtotal,
  }
}

/**
 * Validate voucher — chỉ coi là áp dụng được khi BE xác nhận (serverConfirmed).
 * Production: luôn gọi POST /vouchers/validate (BE đọc giỏ server). Không fake valid từ catalog.
 */
export async function validateCartVoucher(options: {
  code: string
  lines: CartLine[]
  cartSubtotal: number
  singleSellerId?: string | null
}): Promise<CartVoucherResult> {
  const code = options.code.trim()
  if (!code) {
    return { valid: false, message: 'Vui lòng nhập mã giảm giá.', serverConfirmed: false }
  }

  if (!options.lines.length) {
    return {
      valid: false,
      message: 'Thêm sản phẩm vào giỏ trước khi dùng mã giảm giá.',
      serverConfirmed: false,
    }
  }

  if (!apiConfig.useRealOrders) {
    const demo = demoVoucherFallback(code, options.cartSubtotal, options.singleSellerId ?? null)
    if (demo) return demo
    return {
      valid: false,
      message: 'Mã giảm giá không đúng hoặc không dùng được cho giỏ hàng này.',
      serverConfirmed: false,
    }
  }

  try {
    const productIds = cartProductIdsForVoucher(options.lines)
    const res = await voucherApi.validate(code, productIds)
    if (res.valid) {
      return {
        ...res,
        serverConfirmed: true,
        message: res.message || 'Áp dụng mã giảm giá thành công.',
      }
    }
    return {
      ...res,
      valid: false,
      serverConfirmed: false,
      message: voucherUserMessage(res.message),
    }
  } catch (e) {
    const apiMsg = e instanceof Error ? e.message : ''
    return {
      valid: false,
      serverConfirmed: false,
      message: voucherUserMessage(apiMsg || 'Không áp dụng được mã giảm giá lúc này.'),
    }
  }
}

/** Chỉ gửi mã lên BE khi validate đã được server xác nhận. */
export function voucherCodeForOrder(res: CartVoucherResult | null | undefined): string | undefined {
  if (!res?.valid || res.serverConfirmed === false) return undefined
  return res.code?.trim() || undefined
}
