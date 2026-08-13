import { describe, expect, it } from 'vitest'
import { asksProductPrice, asksProductReview, normalizeText } from '@/api/chat/match'

describe('product query helpers', () => {
  it('treats "đánh giá" as review, not price', () => {
    const q = normalizeText('các khách khác đánh giá sản phẩm này sao')
    expect(asksProductReview(q)).toBe(true)
    expect(asksProductPrice(q)).toBe(false)
  })

  it('treats "khách thấy sao" as review', () => {
    const q = normalizeText('khách thấy sao')
    expect(asksProductReview(q)).toBe(true)
    expect(asksProductPrice(q)).toBe(false)
  })

  it('still detects explicit price questions', () => {
    expect(asksProductPrice(normalizeText('giá bao nhiêu'))).toBe(true)
    expect(asksProductPrice(normalizeText('High Waist Jeans giá'))).toBe(true)
  })
})
