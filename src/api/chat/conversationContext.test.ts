import { describe, expect, it } from 'vitest'
import {
  buildConversationContext,
  emptyConversationContext,
  updateConversationContext,
} from '@/api/chat/conversationContext'
import type { ChatMessage } from '@/types'

describe('conversationContext', () => {
  it('starts empty without history', () => {
    const ctx = buildConversationContext([])
    expect(ctx.activeTask).toBe('general')
    expect(ctx.lastResults).toHaveLength(0)
  })

  it('picks product from last bot card', () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'ok',
        timestamp: '',
        products: [{ id: 'p1', name: 'KeyPro', price: 1_000_000, imageUrl: '' }],
      },
    ]
    const ctx = buildConversationContext(history)
    expect(ctx.currentProduct?.id).toBe('p1')
    expect(ctx.activeTask).toBe('product_qa')
  })

  it('prefers attachments over stale history', () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'ok',
        timestamp: '',
        products: [{ id: 'old', name: 'Old', price: 1, imageUrl: '' }],
      },
    ]
    const ctx = buildConversationContext(history, [
      { id: 'new', name: 'Skirt', price: 500_000, imageUrl: '' },
    ])
    expect(ctx.currentProduct?.id).toBe('new')
  })

  it('resets on clear topic switch', () => {
    const prev = {
      ...emptyConversationContext(),
      currentProduct: { id: 'p1', name: 'X', price: 1, imageUrl: '' },
      activeTask: 'product_qa' as const,
    }
    const next = updateConversationContext(prev, {
      userMessage: 'don hang cua toi',
      intent: 'orders',
    })
    expect(next.currentProduct).toBeUndefined()
    expect(next.activeTask).toBe('order')
  })

  it('keeps focus on price follow-up', () => {
    const prev = buildConversationContext([
      {
        id: '1',
        role: 'assistant',
        content: 'ok',
        timestamp: '',
        products: [{ id: 'p1', name: 'SP', price: 2_000_000, imageUrl: '' }],
      },
    ])
    const next = updateConversationContext(prev, {
      userMessage: 'gia bao nhieu',
      intent: 'product_price',
    })
    expect(next.currentProduct?.id).toBe('p1')
    expect(next.lastIntent).toBe('product_price')
  })
})
