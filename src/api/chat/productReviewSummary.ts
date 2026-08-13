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

export type ReviewConfidence = 'none' | 'small' | 'moderate' | 'solid'

export function reviewSampleConfidence(totalReviews: number): ReviewConfidence {
  if (totalReviews <= 0) return 'none'
  if (totalReviews < 5) return 'small'
  if (totalReviews < 20) return 'moderate'
  return 'solid'
}

export function reviewConfidenceLabel(confidence: ReviewConfidence): string | undefined {
  switch (confidence) {
    case 'small':
      return 'Tín hiệu tích cực, mẫu còn nhỏ'
    case 'moderate':
      return 'Đủ để tham khảo, chưa quá nhiều review'
    default:
      return undefined
  }
}

function plainPurchaseInsight(soldCount: number, totalReviews: number): string | undefined {
  if (soldCount <= 0) return undefined
  if (totalReviews <= 0) {
    return `Đã có ${soldCount.toLocaleString('vi-VN')} lượt mua nhưng chưa ai để lại đánh giá chi tiết.`
  }
  if (soldCount > totalReviews) {
    const pct = Math.round((totalReviews / soldCount) * 100)
    if (pct < 40 && soldCount >= 10) {
      return `${totalReviews} review / ${soldCount.toLocaleString('vi-VN')} lượt mua (~${pct}%) — nhiều khách mua, ít để lại nhận xét.`
    }
    return `${pct}% người mua để lại đánh giá (${totalReviews}/${soldCount.toLocaleString('vi-VN')} lượt).`
  }
  return undefined
}

function shortProductLabel(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean)
  const modelish = tokens.filter((t) => /[A-Z]/.test(t) && /\d/.test(t))
  if (modelish.length) return modelish.join(' ')
  if (name.length > 42) return `${name.slice(0, 40)}…`
  return name
}

const PRAISE_THEMES: [RegExp, string][] = [
  [/rgb|led|mau sac|anh sang/, 'RGB / ánh sáng'],
  [/go|cam tay|switch|ban phim|phim/, 'cảm giác gõ'],
  [/dep|ngoai hinh|thiet ke|gaming/, 'ngoại hình'],
  [/chat luong|ben|tot|on/, 'chất lượng'],
  [/giao|ship|nhanh/, 'giao hàng'],
  [/size|vua|form|mac/, 'size / form'],
  [/pin|sac|thoi luong/, 'pin / thời lượng'],
  [/am thanh|tieng|nghe/, 'âm thanh'],
]

function extractPraiseThemes(highlights: ChatReviewHighlight[]): string[] {
  const blob = highlights
    .map((h) => h.comment.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
    .join(' ')
  const out: string[] = []
  for (const [re, label] of PRAISE_THEMES) {
    if (re.test(blob) && !out.includes(label)) out.push(label)
  }
  return out.slice(0, 3)
}

function negativeHint(highlights: ChatReviewHighlight[]): string | undefined {
  const low = highlights.filter((h) => h.rating <= 3 && h.comment.trim().length > 12)
  if (!low.length) return undefined
  const c = low[0].comment.trim().slice(0, 100)
  return c.length > 20 ? c : undefined
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

/** Văn bản insight trong bubble — card bên dưới là bằng chứng. */
export function buildReviewReplyText(summary: ChatReviewSummary, userName?: string): string {
  const greet =
    userName?.trim() && userName.length >= 2 && !/guest|khach hang/i.test(userName)
      ? `${userName.trim().split(/\s+/).pop()}, `
      : ''
  const label = shortProductLabel(summary.productName)

  if (!summary.hasReviews) {
    const sold =
      summary.soldCount > 0
        ? ` Đã có **${summary.soldCount.toLocaleString('vi-VN')}** lượt mua nhưng chưa có review chi tiết.`
        : ''
    return `${greet}**${label}** chưa có đánh giá từ khách — bạn có thể là người đầu tiên trên trang sản phẩm.${sold}`
  }

  const conf = reviewSampleConfidence(summary.totalReviews)
  const rating = summary.averageRating
  const parts: string[] = []

  if (conf === 'small') {
    if (rating >= 4.2) {
      parts.push(
        `${greet}**${label}** đang có **${rating}/5** — khá cao, nhưng mới từ **${summary.totalReviews}** đánh giá nên mình xem đây là tín hiệu tích cực ban đầu, chưa đủ để kết luận chắc chắn.`,
      )
    } else {
      parts.push(
        `${greet}Trong **${summary.totalReviews}** đánh giá hiện có, **${label}** đang ở **${rating}/5**.`,
      )
    }
  } else if (conf === 'moderate') {
    parts.push(
      `${greet}**${label}** được đánh giá khá tích cực — **${rating}/5** từ **${summary.totalReviews}** lượt review.`,
    )
  } else {
    parts.push(
      `${greet}**${label}** nhận phản hồi tốt từ người mua — **${rating}/5** (${summary.totalReviews} đánh giá).`,
    )
  }

  if (summary.soldCount > summary.totalReviews * 8 && summary.soldCount >= 30) {
    parts.push(
      `SP đã có **${summary.soldCount.toLocaleString('vi-VN')}** lượt mua — nhiều khách chưa để lại review nên số đánh giá còn ít hơn lượt mua.`,
    )
  } else if (summary.purchaseInsight && conf !== 'small') {
    parts.push(summary.purchaseInsight)
  }

  const themes = extractPraiseThemes(summary.highlights)
  if (themes.length) {
    parts.push(`\n👍 Người mua thường khen: ${themes.map((t) => `**${t}**`).join(', ')}.`)
  }

  const neg = negativeHint(summary.highlights)
  if (neg) {
    parts.push(`\n👎 Một số ý chưa hài lòng: *"${neg}${neg.length >= 100 ? '…' : ''}"*`)
  }

  const quote = summary.highlights.find((h) => h.comment.trim().length > 18)
  if (quote) {
    parts.push(
      `\n💬 *"${quote.comment}"* — **${quote.userName}** (${quote.rating}★)`,
    )
  }

  const confLabel = reviewConfidenceLabel(conf)
  if (confLabel) {
    parts.push(`\n_${confLabel}._`)
  }

  return parts.join('')
}

/** @deprecated dùng buildReviewReplyText */
export function reviewSummaryIntro(summary: ChatReviewSummary, userName?: string): string {
  return buildReviewReplyText(summary, userName)
}
