import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'

export interface BackendCartItem {
  id: number
  productId: number
  productName: string
  price: number | string
  quantity: number
  totalPrice?: number | string
}

export interface BackendCartResponse {
  cartId: number
  userId: number
  items: BackendCartItem[]
  totalAmount: number | string
}

function num(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback
  return typeof v === 'number' ? v : Number(v)
}

export async function getCart(): Promise<BackendCartResponse> {
  return http.get<BackendCartResponse>(apiPaths.cart.mine)
}

export async function addCartItem(productId: string, quantity: number): Promise<BackendCartResponse> {
  return http.post<BackendCartResponse>(apiPaths.cart.items, {
    productId: Number(productId),
    quantity,
  })
}

export async function updateCartItem(itemId: string, quantity: number): Promise<BackendCartResponse> {
  return http.put<BackendCartResponse>(apiPaths.cart.item(itemId), { quantity })
}

export async function removeCartItem(itemId: string): Promise<void> {
  await http.delete<void>(apiPaths.cart.item(itemId))
}

export async function clearCart(): Promise<void> {
  await http.delete<void>(apiPaths.cart.mine)
}

export { num as cartNum }
