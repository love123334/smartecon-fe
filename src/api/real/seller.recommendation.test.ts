import { describe, expect, it } from 'vitest'
import { normalizeSellerRecommendation } from '@/api/real/seller'

describe('normalizeSellerRecommendation', () => {
  it('parses stringified recommendation JSON', () => {
    const raw = JSON.stringify({
      id: 'REC_ALL_GOOD',
      title: 'Vận hành tuyệt vời!',
      message: 'Gian hàng của bạn đang hoạt động rất tốt. Không có cảnh báo nào cần xử lý ngay.',
      priority: 'INFO',
      actionUrl: '/seller/analytics',
      actionLabel: 'Xem phân tích',
    })
    const rec = normalizeSellerRecommendation(raw, 0)
    expect(rec.title).toBe('Vận hành tuyệt vời!')
    expect(rec.message).toMatch(/hoạt động rất tốt/)
    expect(rec.message.startsWith('{')).toBe(false)
    expect(rec.actionLabel).toBe('Xem phân tích')
    expect(rec.priority).toBe('INFO')
  })

  it('unwraps JSON stuck in message field', () => {
    const rec = normalizeSellerRecommendation(
      {
        title: 'Gợi ý từ dashboard',
        message: JSON.stringify({
          id: 'REC_ALL_GOOD',
          title: 'Vận hành tuyệt vời!',
          message: 'Shop ổn định.',
          priority: 'INFO',
          actionUrl: '/seller/analytics',
          actionLabel: 'Xem phân tích',
        }),
        priority: 'MEDIUM',
      },
      1,
    )
    expect(rec.title).toBe('Vận hành tuyệt vời!')
    expect(rec.message).toBe('Shop ổn định.')
    expect(rec.priority).toBe('INFO')
  })
})
