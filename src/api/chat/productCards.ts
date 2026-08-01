import type { ChatProductRef, Product } from '@/types'
import { apiConfig } from '@/api/config'
import * as realInventory from '@/api/real/inventory'

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
  const rawStock = 'stock' in product ? product.stock : undefined
  // List API hay để stock=0 mặc định — đừng nhét vào chat (sẽ hiện "Hết hàng" giả).
  // Tồn thật được refreshChatProductStock / catalog withStock gắn lại.
  const stock =
    typeof rawStock === 'number' && rawStock > 0 ? rawStock : undefined
  const card: ChatProductRef = {
    id: String(product.id),
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    category: product.category,
    stock,
    shopName: product.shopName,
    rating: 'rating' in product ? product.rating : undefined,
    originalPrice: product.originalPrice,
  }
  return JSON.stringify(card)
}

/** Đồng bộ tồn kho từ inventory API — tránh card list (stock=0 mặc định) lệch với chatbot. */
export async function refreshChatProductStock(
  products: ChatProductRef[],
): Promise<ChatProductRef[]> {
  if (!products.length) return products
  if (!apiConfig.useRealInventory || !localStorage.getItem('sedsp_access_token')?.trim()) {
    return products
  }
  return Promise.all(
    products.map(async (p) => {
      try {
        const inv = await realInventory.getInventory(p.id)
        return { ...p, stock: inv.availableQuantity }
      } catch {
        return p
      }
    }),
  )
}
