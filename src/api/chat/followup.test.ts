import { describe, expect, it } from 'vitest'
import { isProductFollowUp, lastDiscussedProducts } from '@/api/chat/followup'
import { detectIntent } from '@/api/chat/intents'
import { normalizeText } from '@/api/chat/match'
import type { ChatMessage } from '@/types'

describe('chat follow-up context', () => {
  it('maps "dùng làm gì" to product_info, not platform', () => {
    const hit = detectIntent('dùng làm gì', 'customer')
    expect(hit?.intent).toBe('product_info')
  })

  it('still maps SEDSP app questions to platform', () => {
    const hit = detectIntent('SEDSP là gì', 'customer')
    expect(hit?.intent).toBe('platform')
  })

  it('detects product attribute follow-ups', () => {
    expect(isProductFollowUp(normalizeText('dùng làm gì'))).toBe(true)
    expect(isProductFollowUp(normalizeText('còn hàng không'))).toBe(true)
    expect(isProductFollowUp(normalizeText('giá bao nhiêu'))).toBe(true)
    expect(isProductFollowUp(normalizeText('có món đồ gì hot'))).toBe(false)
  })

  it('reads last discussed product from history', () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'AirPods',
        timestamp: '',
        attachments: [
          {
            id: 'p1',
            name: 'AirPods Pro 2',
            price: 5990000,
            imageUrl: '',
          },
        ],
      },
      {
        id: '2',
        role: 'assistant',
        content: 'AirPods Pro 2...',
        timestamp: '',
        products: [
          {
            id: 'p1',
            name: 'AirPods Pro 2',
            price: 5990000,
            imageUrl: '',
            category: 'Phụ kiện',
          },
        ],
      },
    ]
    expect(lastDiscussedProducts(history)[0]?.name).toBe('AirPods Pro 2')
  })
})
