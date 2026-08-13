import type { ChatReviewHighlight, ChatReviewSummary } from '@/types'
import type { Product, ProductReview, RatingSummary } from '@/types'

/** Chọn review có nội dung dài, rating cao — proxy "hữu ích" khi chưa có vote helpful. */
export function pickRepresentativeReviews(reviews: ProductReview[], limit = 3): ProductReview[] {
  return [...reviews]
    .filter((r) => r.comment?.trim())
    .sort((a, b) => {
      const lenA = a.comment.trim().length
      const lenB = b.comment.trim().length
      if (lenB !== lenA) return lenB - lenA
      return b.rating - a.rating
    })
    .slice(0, limit)
}

export function formatReviewStars(rating: number): string {
  const safe = Math.max(1, Math.min(5, Math.round(rating)))
  return '★'.repeat(safe) + (safe < 5 ? '☆'.repeat(5 - safe) : '')
}

function plainPurchaseInsight(soldCount: number, totalReviews: number): string | undefined {
  if (soldCount <= 0) return undefined
  if (totalReviews <= 0) {
    return `Đã có ${soldCount} lượt mua nhưng chưa ai để lại đánh giá chi tiết.`
  }
  if (soldCount > totalReviews) {
    const pct = Math.round((totalReviews / soldCount) * 100)
    if (pct < 40 && soldCount >= 10) {
      return `${totalReviews} review / ${soldCount} lượt mua (~${pct}%) — nhiều khách quen, ít để lại review.`
    }
    return `${pct}% người mua để lại đánh giá (${totalReviews}/${soldCount} lượt).`
  }
  return undefined
}

export function buildProductReviewSummary(
  product: Product,
  summary: RatingSummary | null | undefined,
  reviews: ProductReview[],
): ChatReviewSummary {
  const picked = pickRepresentativeReviews(reviews, 3)
  const totalReviews = Math.max(
    summary?.totalReviews ?? 0,
    product.reviewCount ?? 0,
    picked.length,
  )
  const hasReviews = totalReviews > 0 || picked.length > 0

  let averageRating = 0
  if (summary?.averageRating && summary.averageRating > 0) {
    averageRating = summary.averageRating
  } else if (product.rating > 0) {
    averageRating = product.rating
  } else if (picked.length) {
    averageRating = picked.reduce((s, r) => s + r.rating, 0) / picked.length
  }

  const highlights: ChatReviewHighlight[] = picked.map((r) => ({
    id: r.id,
    userName: r.userName,
    rating: r.rating,
    comment:
      r.comment.trim().slice(0, 160) + (r.comment.trim().length > 160 ? '…' : ''),
  }))

  const origin =
    product.attributes?.find((a) => /xuat xu|origin|made in|nguon goc/i.test(a.name))?.value ??
    product.shopLocation ??
    undefined

  return {
    productId: String(product.id),
    productName: product.name,
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews,
    soldCount: product.soldCount ?? 0,
    hasReviews,
    purchaseInsight: plainPurchaseInsight(product.soldCount ?? 0, totalReviews),
    origin: origin?.trim() || undefined,
    shopName: product.shopName,
    price: product.price,
    highlights,
  }
}

export function reviewSummaryIntro(summary: ChatReviewSummary, userName?: string): string {
  const greet =
    userName?.trim() && userName.length >= 2 && !/guest|khach hang/i.test(userName)
      ? `${userName.trim().split(/\s+/).pop()}, `
      : ''
  if (!summary.hasReviews) {
    return `${greet}**${summary.productName}** chưa có đánh giá từ khách — bạn có thể là người đầu tiên trên trang sản phẩm.`
  }
  const stars = summary.averageRating > 0 ? ` **${summary.averageRating}★**` : ''
  const count =
    summary.totalReviews > 0
      ? ` từ **${summary.totalReviews}** đánh giá người mua`
      : ''
  return `${greet}Mọi người nhìn chung${stars}${count} về **${summary.productName}** — tóm tắt bên dưới nhé.`
}
