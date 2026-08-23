import type { Order, ProductReview } from '@/types'

/** Số ngày được đánh giá sau khi đơn giao thành công */
export const REVIEW_WINDOW_DAYS = 30

export type ReviewBlockReason =
  | 'login'
  | 'role'
  | 'not_purchased'
  | 'not_delivered'
  | 'expired'
  | 'already_reviewed'

export type ReviewEligibility =
  | {
      canReview: true
      orderId: string
      daysLeft: number
      eligibleUntil: string
      purchasedAt: string
    }
  | {
      canReview: false
      reason: ReviewBlockReason
      message: string
      orderId?: string
    }

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

/** Thời điểm bắt đầu tính 30 ngày: ưu tiên updatedAt khi đã giao, không thì createdAt */
export function reviewAnchorDate(order: Order): Date {
  const raw = order.status === 'delivered' ? order.updatedAt || order.createdAt : order.createdAt
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date(order.createdAt) : d
}

function sameUserId(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const na = a.replace(/^seller-/i, '').trim()
  const nb = b.replace(/^seller-/i, '').trim()
  return na === nb
}

/**
 * Khách chỉ được đánh giá khi:
 * 1) Đã mua SP trong đơn đã giao (delivered)
 * 2) Trong vòng 30 ngày kể từ ngày giao / cập nhật đơn
 * 3) Chưa đánh giá SP này
 */
export function checkReviewEligibility(opts: {
  isLoggedIn: boolean
  /** Customer hoặc seller mua hàng đều được đánh giá sau khi nhận hàng */
  isCustomer: boolean
  productId: string
  orders: Order[]
  existingReviews: ProductReview[]
  currentUserId?: string
  now?: Date
}): ReviewEligibility {
  const now = opts.now ?? new Date()

  if (!opts.isLoggedIn) {
    return {
      canReview: false,
      reason: 'login',
      message: 'Đăng nhập để đánh giá sản phẩm đã mua.',
    }
  }
  if (!opts.isCustomer) {
    return {
      canReview: false,
      reason: 'role',
      message: 'Chỉ tài khoản khách hàng hoặc người bán (khi mua hàng) mới được đánh giá.',
    }
  }

  if (
    opts.currentUserId &&
    opts.existingReviews.some((r) => sameUserId(r.userId, opts.currentUserId))
  ) {
    return {
      canReview: false,
      reason: 'already_reviewed',
      message: 'Bạn đã đánh giá sản phẩm này rồi.',
    }
  }

  const withProduct = opts.orders.filter((o) =>
    o.items.some((i) => i.productId === opts.productId),
  )

  if (!withProduct.length) {
    return {
      canReview: false,
      reason: 'not_purchased',
      message: 'Bạn chưa mua sản phẩm này. Chỉ đánh giá được sau khi đơn đã giao thành công.',
    }
  }

  const delivered = withProduct
    .filter((o) => o.status === 'delivered')
    .sort((a, b) => reviewAnchorDate(b).getTime() - reviewAnchorDate(a).getTime())

  if (!delivered.length) {
    const latest = withProduct.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0]
    return {
      canReview: false,
      reason: 'not_delivered',
      orderId: latest?.id,
      message:
        'Đơn chứa sản phẩm này chưa giao xong. Bạn chỉ đánh giá được sau khi trạng thái là **Đã giao**.',
    }
  }

  const order = delivered[0]
  const anchor = reviewAnchorDate(order)
  const elapsed = daysBetween(anchor, now)

  if (elapsed > REVIEW_WINDOW_DAYS) {
    return {
      canReview: false,
      reason: 'expired',
      orderId: order.id,
      message: `Đã quá ${REVIEW_WINDOW_DAYS} ngày kể từ khi nhận hàng (đơn #${order.id}). Không thể đánh giá thêm.`,
    }
  }

  const eligibleUntil = new Date(anchor)
  eligibleUntil.setDate(eligibleUntil.getDate() + REVIEW_WINDOW_DAYS)

  return {
    canReview: true,
    orderId: order.id,
    daysLeft: Math.max(0, REVIEW_WINDOW_DAYS - elapsed),
    eligibleUntil: eligibleUntil.toISOString(),
    purchasedAt: anchor.toISOString(),
  }
}
