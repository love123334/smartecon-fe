import type { ProductReview } from '@/types'

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

/** Gợi ý từ doanh số vs số review — không bịa tỷ lệ mua lại cứng. */
export function purchaseReviewInsight(soldCount: number, totalReviews: number): string | null {
  if (soldCount <= 0) return null
  if (totalReviews <= 0) {
    return `Đã có **${soldCount}** lượt mua nhưng chưa ai để lại đánh giá chi tiết.`
  }
  if (soldCount > totalReviews) {
    const pct = Math.round((totalReviews / soldCount) * 100)
    if (pct < 40 && soldCount >= 10) {
      return `**${totalReviews}** review trên **${soldCount}** lượt mua (~${pct}%) — nhiều khách mua lại/không review, phổ biến với SP quen thuộc.`
    }
    return `**${pct}%** người mua để lại đánh giá (${totalReviews}/${soldCount} lượt).`
  }
  return null
}
