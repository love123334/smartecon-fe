import { describe, expect, it } from 'vitest'
import {
  filterOrdersBySpec,
  parseOrderQuery,
  presentOrdersReply,
} from '@/api/chat/orderQuery'
import type { Order } from '@/types'

function order(
  partial: Partial<Order> & Pick<Order, 'id' | 'status' | 'createdAt'>,
): Order {
  return {
    customerId: 'u1',
    customerName: 'Test User',
    items: [{ productId: 'p1', productName: 'KeyPro K87', quantity: 1, unitPrice: 1_500_000 }],
    total: partial.total ?? 1_500_000,
    shippingAddress: 'HCM',
    updatedAt: partial.createdAt,
    ...partial,
  }
}

describe('parseOrderQuery', () => {
  it('detects today temporal scope', () => {
    const { spec } = parseOrderQuery('đơn hàng của tôi hôm nay sao rồi?')
    expect(spec.timeRange.type).toBe('today')
    expect(spec.detailLevel).toBe('summary')
  })

  it('detects yesterday scope', () => {
    const { spec } = parseOrderQuery('đơn hôm qua có gì?')
    expect(spec.timeRange.type).toBe('yesterday')
  })

  it('detects in-transit status filter', () => {
    const { spec } = parseOrderQuery('đơn đang giao')
    expect(spec.statusFilter).toBe('in_transit')
  })

  it('keeps prior time range on status follow-up', () => {
    const prior = parseOrderQuery('đơn hôm qua').spec
    const { spec, fromPrior } = parseOrderQuery('còn đơn đang giao?', prior)
    expect(fromPrior).toBe(true)
    expect(spec.timeRange.type).toBe('yesterday')
    expect(spec.statusFilter).toBe('in_transit')
  })

  it('switches to detail level when asked', () => {
    const { spec } = parseOrderQuery('chi tiết đơn hôm nay')
    expect(spec.detailLevel).toBe('detail')
    expect(spec.timeRange.type).toBe('today')
  })
})

describe('presentOrdersReply', () => {
  const now = new Date('2026-08-23T15:00:00')
  const todayMorning = '2026-08-23T09:00:00'
  const todayAfternoon = '2026-08-23T14:00:00'

  it('summarizes multiple today orders without dumping raw fields', () => {
    const orders: Order[] = [
      order({ id: '101', status: 'delivered', createdAt: todayMorning }),
      order({ id: '102', status: 'shipping', createdAt: todayAfternoon, total: 2_850_000 }),
    ]
    const { spec } = parseOrderQuery('đơn hôm nay sao rồi?')
    const filtered = filterOrdersBySpec(orders, spec, now)
    const reply = presentOrdersReply(filtered, spec)

    expect(filtered).toHaveLength(2)
    expect(reply).toMatch(/2.*đơn/i)
    expect(reply).toMatch(/giao/i)
    expect(reply).not.toMatch(/updatedAt|paymentMethod|shippingAddress|createdAt/)
    expect(reply).not.toMatch(/DELIVERED|PENDING/)
  })

  it('returns empty scope message for yesterday with no orders', () => {
    const { spec } = parseOrderQuery('đơn hôm qua')
    const reply = presentOrdersReply([], spec)
    expect(reply).toMatch(/hôm qua.*chưa có/i)
  })
})
