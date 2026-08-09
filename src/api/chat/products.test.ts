import { describe, expect, it } from 'vitest'
import {
  affordableProductsForQuery,
  computeProductPriceStats,
  extractAffordableSearchTerms,
  extractBudgetVnd,
  extractPriceRange,
  extractProductFocusLabel,
  extractSellerNameQuery,
  filterProductsForQuery,
  findProductsByQuery,
  findProductsBySellerName,
  isAffordableProductQuery,
  isPriceStatsQuery,
  stripAffordableMarkers,
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

describe('affordable product queries', () => {
  it('detects "kính rẻ" without numeric budget', () => {
    expect(isAffordableProductQuery('kính rẻ')).toBe(true)
    expect(isAffordableProductQuery('kính giá rẻ')).toBe(true)
    expect(isAffordableProductQuery('tai nghe dưới 2 triệu')).toBe(false)
  })

  it('extracts product keyword from affordable phrase', () => {
    expect(extractAffordableSearchTerms('kính giá rẻ')).toEqual(['kinh'])
    expect(stripAffordableMarkers('tai nghe giá rẻ')).toContain('tai nghe')
  })

  it('sorts matches by ascending price', () => {
    const glasses: Product[] = [
      p({ id: 'g1', name: 'Kính mát UV400', price: 890_000, category: 'Phụ kiện' }),
      p({ id: 'g2', name: 'Kính cận gọng nhẹ', price: 450_000, category: 'Phụ kiện' }),
    ]
    const hits = affordableProductsForQuery(glasses, 'kính rẻ', 4)
    expect(hits.map((x) => x.id)).toEqual(['g2', 'g1'])
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

describe('macbook price stats', () => {
  const laptops: Product[] = [
    p({ id: 'm1', name: 'MacBook Air M3', price: 32_990_000, category: 'Laptop' }),
    p({ id: 'm2', name: 'MacBook Pro 14', price: 48_990_000, category: 'Laptop' }),
    p({ id: 'd1', name: 'Dell XPS 15', price: 38_990_000, category: 'Laptop' }),
    p({ id: 'h1', name: 'HP Spectre x360', price: 35_990_000, category: 'Laptop' }),
  ]

  it('detects average-price questions', () => {
    expect(isPriceStatsQuery('giá macbook trung bình')).toBe(true)
    expect(isPriceStatsQuery('macbook nào ngon')).toBe(false)
  })

  it('keeps MacBook hits without dumping Dell/HP', () => {
    const hits = findProductsByQuery(laptops, 'giá macbook trung bình')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((x) => /macbook/i.test(x.name))).toBe(true)
    expect(hits.some((x) => /dell|hp/i.test(x.name))).toBe(false)
  })

  it('computes average / min / max for MacBooks', () => {
    const macs = findProductsByQuery(laptops, 'macbook')
    const stats = computeProductPriceStats(macs, 'Macbook', 4)
    expect(stats?.count).toBe(2)
    expect(stats?.average).toBe((32_990_000 + 48_990_000) / 2)
    expect(stats?.min).toBe(32_990_000)
    expect(stats?.max).toBe(48_990_000)
  })
})

describe('tai nghe giá cả trung bình', () => {
  const mixed: Product[] = [
    p({ id: '1', name: 'Tai nghe Bluetooth Pro ANC', price: 1_890_000, category: 'Điện tử' }),
    p({ id: '5', name: 'Tai nghe gaming rẻ', price: 450_000, category: 'Điện tử' }),
    p({ id: '2', name: 'Centella Facial Cleanser', price: 299_000, category: 'Chăm sóc da' }),
    p({ id: '3', name: 'Vitamin C Serum 20ml', price: 459_000, category: 'Chăm sóc da' }),
    p({ id: '4', name: 'Electric Kettle 1.8L', price: 499_000, category: 'Nhà bếp' }),
    p({
      id: '6',
      name: 'Xiaomi 14 Ultra',
      price: 21_990_000,
      category: 'Điện thoại',
      description: 'bluetooth 5.3 smartphone',
    }),
  ]

  it('labels as Tai Nghe not Tai Nghe Ca', () => {
    expect(extractProductFocusLabel('tai nghe giá cả trung bình')).toBe('Tai Nghe')
  })

  it('strips giá cả from search text', () => {
    expect(stripPriceTokens('tai nghe giá cả trung bình')).toBe('tai nghe')
  })

  it('only returns headphones for average-price query', () => {
    const hits = findProductsByQuery(mixed, stripPriceTokens('tai nghe giá cả trung bình'))
    expect(hits.length).toBe(2)
    expect(hits.every((x) => /tai nghe/i.test(x.name))).toBe(true)
    expect(hits.some((x) => /centella|serum|kettle|xiaomi/i.test(x.name))).toBe(false)
  })

  it('computes headphone price stats without skincare/phone', () => {
    const hits = findProductsByQuery(mixed, 'tai nghe')
    const stats = computeProductPriceStats(hits, extractProductFocusLabel('tai nghe giá cả trung bình'), 4)
    expect(stats?.count).toBe(2)
    expect(stats?.min).toBe(450_000)
    expect(stats?.max).toBe(1_890_000)
    expect(stats?.cheapest.name).toMatch(/tai nghe/i)
    expect(stats?.priciest.name).toMatch(/tai nghe/i)
  })
})

describe('seller name product search', () => {
  const withShops: Product[] = [
    p({
      id: 's1',
      name: 'Serum Vitamin C',
      price: 299_000,
      category: 'Chăm sóc da',
      shopName: 'Trần Thị Bán',
    }),
    p({
      id: 's2',
      name: 'Áo thun basic',
      price: 199_000,
      category: 'Thời trang',
      shopName: 'Trần Thị Bán',
    }),
    p({
      id: 'o1',
      name: 'Crop Top Basic',
      price: 299_000,
      category: 'Thời trang',
      shopName: 'SEDSP Fashion',
    }),
  ]

  it('extracts seller name from "sản phẩm của …"', () => {
    expect(extractSellerNameQuery('Cho tôi xem sản phẩm của Trần Thị Bán')).toBe('tran thi ban')
    expect(extractSellerNameQuery('sản phẩm nào rẻ nhất')).toBeNull()
  })

  it('filters products by shop / seller full name', () => {
    const hits = findProductsBySellerName(withShops, 'tran thi ban')
    expect(hits.map((x) => x.id).sort()).toEqual(['s1', 's2'])
  })

  it('filterProductsForQuery uses seller path', () => {
    const { products, queryText } = filterProductsForQuery(
      withShops,
      'Cho tôi xem sản phẩm của Trần Thị Bán',
    )
    expect(queryText).toBe('tran thi ban')
    expect(products.every((x) => x.shopName === 'Trần Thị Bán')).toBe(true)
    expect(products.some((x) => x.id === 'o1')).toBe(false)
  })
})
