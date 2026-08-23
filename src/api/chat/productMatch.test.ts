import { describe, expect, it } from 'vitest'
import {
  presentProductSearchResult,
  searchProductsWithPolicy,
} from '@/api/chat/productMatch'
import type { Product } from '@/types'

function p(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'price' | 'category'>): Product {
  return {
    description: partial.description ?? '',
    stock: 10,
    imageUrl: '',
    sellerId: 's1',
    rating: 4,
    soldCount: 20,
    createdAt: '2026-01-01',
    ...partial,
  }
}

const fashionCatalog: Product[] = [
  p({ id: '1', name: 'Áo thun nam basic', price: 199_000, category: 'Thời trang', description: 'áo thun cotton nam' }),
  p({ id: '2', name: 'Áo sơ mi nam công sở', price: 349_000, category: 'Thời trang', description: 'sơ mi nam' }),
  p({ id: '3', name: 'Quần jean nam slim', price: 449_000, category: 'Thời trang' }),
]

describe('searchProductsWithPolicy', () => {
  it('does not downgrade áo khoác to áo thun', () => {
    const result = searchProductsWithPolicy(fashionCatalog, 'Có áo khoác nam không?')
    expect(result.matchTier).toBe('none')
    expect(result.products).toHaveLength(0)
    expect(result.allowCards).toBe(false)
    expect(result.specificLabel).toBe('áo khoác')
  })

  it('allows broad áo query to match shirts', () => {
    const result = searchProductsWithPolicy(fashionCatalog, 'có áo nam không')
    expect(result.products.length).toBeGreaterThan(0)
    expect(result.allowCards).toBe(true)
  })

  it('allows alternatives only when user asks explicitly', () => {
    const strict = searchProductsWithPolicy(fashionCatalog, 'áo khoác nam')
    expect(strict.allowCards).toBe(false)

    const alt = searchProductsWithPolicy(fashionCatalog, 'áo khoác không có thì có gì tương tự?')
    expect(alt.allowCards).toBe(true)
    expect(alt.alternativeProducts.length).toBeGreaterThan(0)
  })

  it('presentProductSearchResult explains absence without fake match', () => {
    const result = searchProductsWithPolicy(fashionCatalog, 'áo khoác nam')
    const reply = presentProductSearchResult(result)
    expect(reply).toMatch(/chưa có.*áo khoác/i)
    expect(reply).not.toMatch(/áo thun/i)
  })
})
