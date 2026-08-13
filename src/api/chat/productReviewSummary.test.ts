import { describe, expect, it } from 'vitest'
import {
  formatReviewStars,
  pickRepresentativeReviews,
  purchaseReviewInsight,
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

describe('productReviewSummary', () => {
  it('picks longer substantive reviews first', () => {
    const picked = pickRepresentativeReviews(reviews, 2)
    expect(picked[0]?.userName).toBe('Hà')
    expect(picked[1]?.userName).toBe('Lan')
  })

  it('formats star display', () => {
    expect(formatReviewStars(4)).toBe('★★★★☆')
  })

  it('explains review vs purchase ratio', () => {
    expect(purchaseReviewInsight(42, 8)).toMatch(/42/)
    expect(purchaseReviewInsight(42, 8)).toMatch(/8/)
  })
})
