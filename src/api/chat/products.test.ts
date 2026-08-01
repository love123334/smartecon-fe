import { describe, expect, it } from 'vitest'
import {
  extractBudgetVnd,
  extractPriceRange,
  filterProductsForQuery,
  stripPriceTokens,
} from '@/api/chat/products'
import type { Product } from '@/types'

function p(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'price' | 'category'>): Product {
  return {
    description: '',
    stock: 10,
    imageUrl: '',
    sellerId: 's1',
    rating: 4,
    soldCount: 20,
    createdAt: '2026-01-01',
    ...partial,
  }
}

const catalog: Product[] = [
  p({ id: '1', name: 'Tai nghe Bluetooth Pro ANC', price: 1_890_000, category: 'Điện tử' }),
  p({ id: '2', name: 'Bàn phím cơ RGB', price: 2_450_000, category: 'Điện tử' }),
  p({ id: '3', name: 'Giày chạy bộ AirFlex', price: 1_490_000, category: 'Thể thao' }),
  p({ id: '4', name: 'Nồi chiên không dầu', price: 1_290_000, category: 'Nhà bếp' }),
  p({ id: '5', name: 'Tai nghe gaming rẻ', price: 450_000, category: 'Điện tử', stock: 3 }),
]

describe('extractPriceRange', () => {
  it('parses dưới X triệu', () => {
    expect(extractPriceRange('mua tai nghe dưới 2 triệu')).toEqual({ min: null, max: 2_000_000 })
  })

  it('parses từ X đến Y triệu', () => {
    expect(extractPriceRange('laptop từ 10 đến 20 triệu')).toEqual({
      min: 10_000_000,
      max: 20_000_000,
    })
  })

  it('parses khoảng X-Y', () => {
    expect(extractPriceRange('ngân sách 1-3 triệu')).toEqual({
      min: 1_000_000,
      max: 3_000_000,
    })
  })

  it('extractBudgetVnd stays compatible', () => {
    expect(extractBudgetVnd('budget 500k')).toBe(500_000)
  })
})

describe('filterProductsForQuery', () => {
  it('narrows by keyword + budget', () => {
    const { products, range } = filterProductsForQuery(
      catalog,
      'muốn mua tai nghe dưới 2 triệu',
      [{ name: 'Điện tử', slug: 'dien-tu' }],
    )
    expect(range?.max).toBe(2_000_000)
    expect(products.length).toBeGreaterThan(0)
    expect(products.every((x) => x.price <= 2_000_000)).toBe(true)
    expect(products.some((x) => /tai nghe/i.test(x.name))).toBe(true)
    expect(products.every((x) => !/bàn phím/i.test(x.name))).toBe(true)
  })

  it('strips price tokens for text search', () => {
    expect(stripPriceTokens('tai nghe dưới 2 triệu')).toContain('tai nghe')
    expect(stripPriceTokens('tai nghe dưới 2 triệu')).not.toMatch(/2/)
  })
})
