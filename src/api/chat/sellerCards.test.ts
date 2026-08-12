import { describe, expect, it } from 'vitest'
import { sellerCardFromProduct, toChatSellers } from '@/api/chat/sellerCards'
import type { Product } from '@/types'

const sampleProducts: Product[] = [
  {
    id: '1',
    name: 'High Waist Jeans',
    description: '',
    price: 899_000,
    stock: 5,
    category: 'Thời trang',
    imageUrl: '/jeans.jpg',
    sellerId: '12',
    sellerEmail: 'fashion@shop.vn',
    sellerPhone: '0901234567',
    shopName: 'Fashion Hub',
    shopLocation: 'Việt Nam',
    rating: 4.5,
    reviewCount: 8,
    soldCount: 42,
    createdAt: '2025-06-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Denim Jacket',
    description: '',
    price: 1_200_000,
    stock: 3,
    category: 'Thời trang',
    imageUrl: '/jacket.jpg',
    sellerId: '12',
    sellerEmail: 'fashion@shop.vn',
    sellerPhone: '0901234567',
    shopName: 'Fashion Hub',
    shopLocation: 'Việt Nam',
    rating: 4.8,
    reviewCount: 5,
    soldCount: 18,
    createdAt: '2025-06-01T00:00:00.000Z',
  },
]

describe('sellerCards', () => {
  it('aggregates public shop stats without revenue fields', () => {
    const card = sellerCardFromProduct(sampleProducts[0], sampleProducts, { showContact: true })
    expect(card?.shopName).toBe('Fashion Hub')
    expect(card?.productCount).toBe(2)
    expect(card?.totalSold).toBe(60)
    expect(card?.sellerEmail).toBe('fashion@shop.vn')
    expect(card).not.toHaveProperty('revenue')
  })

  it('groups multiple shops', () => {
    const otherShop: Product = {
      ...sampleProducts[0],
      id: '9',
      sellerId: '99',
      shopName: 'Tech Zone',
      name: 'USB-C Hub',
      category: 'Phụ kiện',
    }
    const cards = toChatSellers([...sampleProducts, otherShop], 5)
    expect(cards).toHaveLength(2)
  })
})
