import type { ChatProductRef, Product } from '@/types'

export function toChatProduct(p: Product): ChatProductRef {
  return {
    id: String(p.id),
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    category: p.category,
    stock: p.stock,
    shopName: p.shopName,
    rating: p.rating,
    originalPrice: p.originalPrice,
  }
}

export function toChatProducts(products: Product[], limit = 6): ChatProductRef[] {
  return products.slice(0, limit).map(toChatProduct)
}

export const SEDSP_PRODUCT_DRAG_MIME = 'application/x-sedsp-product'

export function parseDraggedProduct(dataTransfer: DataTransfer | null): ChatProductRef | null {
  if (!dataTransfer) return null
  const raw =
    dataTransfer.getData(SEDSP_PRODUCT_DRAG_MIME) ||
    dataTransfer.getData('application/json') ||
    dataTransfer.getData('text/plain')
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ChatProductRef>
    if (!parsed?.id || !parsed?.name || typeof parsed.price !== 'number') return null
    return {
      id: String(parsed.id),
      name: String(parsed.name),
      price: Number(parsed.price),
      imageUrl: String(parsed.imageUrl ?? ''),
      category: parsed.category,
      stock: parsed.stock,
      shopName: parsed.shopName,
      rating: parsed.rating,
      originalPrice: parsed.originalPrice,
    }
  } catch {
    return null
  }
}

export function productToDragPayload(product: Product | ChatProductRef): string {
  const card: ChatProductRef = {
    id: String(product.id),
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    category: product.category,
    stock: 'stock' in product ? product.stock : undefined,
    shopName: product.shopName,
    rating: 'rating' in product ? product.rating : undefined,
    originalPrice: product.originalPrice,
  }
  return JSON.stringify(card)
}
