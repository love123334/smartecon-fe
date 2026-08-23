import { describe, expect, it } from 'vitest'
import {
  intentAllowedForRole,
  resolveIntentForRole,
  roleHelpHints,
} from '@/api/chat/rolePolicy'

describe('rolePolicy', () => {
  it('seller đơn hàng → đơn bán', () => {
    expect(resolveIntentForRole('orders', 'seller', 'đơn hàng gần đây')).toBe('seller_recent_orders')
  })

  it('seller đơn mua → purchase orders', () => {
    expect(resolveIntentForRole('orders', 'seller', 'đơn mua của tôi')).toBe('seller_purchase_orders')
  })

  it('seller doanh thu → seller_revenue', () => {
    expect(resolveIntentForRole('product_search', 'seller', 'doanh thu tháng này')).toBe('seller_revenue')
  })

  it('customer không được seller DSS trực tiếp', () => {
    expect(intentAllowedForRole('seller_revenue', 'customer')).toBe(false)
    expect(resolveIntentForRole('seller_revenue', 'customer', 'doanh thu')).toBe('help')
  })

  it('roleHelpHints khác nhau customer vs seller', () => {
    expect(roleHelpHints('customer')).toMatch(/đơn hàng|đánh giá/i)
    expect(roleHelpHints('seller')).toMatch(/doanh thu|DSS/i)
  })
})
