import { describe, expect, it } from 'vitest'
import {
  isContinuingProductChat,
  isProductFollowUp,
  lastDiscussedProducts,
  looksLikeOffTopicPlatformReply,
} from '@/api/chat/followup'
import { detectIntent } from '@/api/chat/intents'
import { normalizeText } from '@/api/chat/match'
import type { ChatMessage } from '@/types'

describe('chat follow-up context', () => {
  it('maps "dùng làm gì" to product_info, not platform', () => {
    expect(detectIntent('dùng làm gì', 'customer')?.intent).toBe('product_info')
  })

  it('still maps SEDSP app questions to platform', () => {
    expect(detectIntent('SEDSP là gì', 'customer')?.intent).toBe('platform')
  })

  it('detects product attribute follow-ups', () => {
    expect(isProductFollowUp(normalizeText('dùng làm gì'))).toBe(true)
    expect(isProductFollowUp(normalizeText('còn hàng không'))).toBe(true)
    expect(isProductFollowUp(normalizeText('giá bao nhiêu'))).toBe(true)
    expect(isProductFollowUp(normalizeText('có món đồ gì hot'))).toBe(false)
  })

  it('continues short product chat when prior SP exists', () => {
    expect(isContinuingProductChat(normalizeText('thế nào'), true)).toBe(true)
    expect(isContinuingProductChat(normalizeText('đơn hàng của tôi'), true)).toBe(false)
  })

  it('flags platform boilerplate on product questions', () => {
    expect(
      looksLikeOffTopicPlatformReply(
        normalizeText('dùng làm gì'),
        'SEDSP — Smart E-Commerce Decision Support Platform: mua sắm (catalog VI ~55 SP), bán hàng, DSS (nhu cầu / giá / tồn / what-if) & AI hỗ trợ quyết định.',
      ),
    ).toBe(true)
  })

  it('reads last discussed product from history', () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'AirPods',
        timestamp: '',
        attachments: [{ id: 'p1', name: 'AirPods Pro 2', price: 5990000, imageUrl: '' }],
      },
      {
        id: '2',
        role: 'assistant',
        content: 'AirPods Pro 2...',
        timestamp: '',
        products: [
          { id: 'p1', name: 'AirPods Pro 2', price: 5990000, imageUrl: '', category: 'Phụ kiện' },
        ],
      },
    ]
    expect(lastDiscussedProducts(history)[0]?.name).toBe('AirPods Pro 2')
  })
})
