import { describe, expect, it } from 'vitest'
import {
  buildProductReviewSummary,
  formatReviewStars,
  pickRepresentativeReviews,
} from '@/api/chat/productReviewSummary'
import type { ProductReview } from '@/types'

const reviews: ProductReview[] = [
  {
    id: '1',
    userId: 'u1',
    userName: 'Lan',
    rating: 5,
    comment: 'Form đẹp, vải ổn, mặc đi làm rất hợp',
    createdAt: '2025-01-01',
  },
  {
    id: '2',
    userId: 'u2',
    userName: 'Minh',
    rating: 4,
    comment: 'OK',
    createdAt: '2025-01-02',
  },
  {
    id: '3',
    userId: 'u3',
    userName: 'Hà',
    rating: 5,
    comment: 'Giao nhanh, size chuẩn như mô tả, sẽ mua thêm màu khác',
    createdAt: '2025-01-03',
  },
]

const baseProduct = {
  id: 'p1',
  name: 'Test Product',
  description: '',
  price: 100_000,
  stock: 5,
  category: 'Test',
  imageUrl: '',
  sellerId: 's1',
  shopName: 'Shop',
  rating: 4.5,
  soldCount: 42,
  createdAt: '',
}

describe('productReviewSummary', () => {
  it('picks longer substantive reviews first', () => {
    const picked = pickRepresentativeReviews(reviews, 2)
    expect(picked[0]?.userName).toBe('Hà')
    expect(picked[1]?.userName).toBe('Lan')
  })

  it('formats star display', () => {
    expect(formatReviewStars(4)).toBe('★★★★☆')
  })

  it('marks hasReviews when highlights exist even if summary empty', () => {
    const summary = buildProductReviewSummary(baseProduct, null, reviews)
    expect(summary.hasReviews).toBe(true)
    expect(summary.totalReviews).toBeGreaterThan(0)
    expect(summary.highlights.length).toBeGreaterThan(0)
  })

  it('includes purchase insight from sold vs review counts', () => {
    const summary = buildProductReviewSummary(
      baseProduct,
      { averageRating: 4.5, totalReviews: 8 },
      reviews,
    )
    expect(summary.purchaseInsight).toMatch(/42/)
  })
})
