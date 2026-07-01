import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { SpringPage } from '@/api/real/products'
import type { Order, OrderItem, OrderStatus } from '@/types'

export type BackendPaymentMethod = 'COD' | 'BANK' | 'MOMO'

export interface BackendOrderItem {
  productId: number
  productName: string
  quantity: number
  unitPrice: number | string
  subtotal?: number | string
}

export interface BackendOrderResponse {
  id: number
  status: string
  subtotal?: number | string
  shippingFee?: number | string
  discount?: number | string
  total: number | string
  createdAt?: string | null
  items?: BackendOrderItem[]
}

export interface BackendOrderDetailResponse {
  order: BackendOrderResponse
  shippingAddress: string
  paymentMethod?: BackendPaymentMethod
  tracking?: unknown[]
}

function num(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback
  return typeof v === 'number' ? v : Number(v)
}

function mapStatus(status: string): OrderStatus {
  const map: Record<string, OrderStatus> = {
    PENDING: 'pending',
    PAID: 'confirmed',
    PROCESSING: 'confirmed',
    SHIPPING: 'shipping',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REFUNDED: 'cancelled',
  }
  return map[status] ?? 'pending'
}

function mapItems(items: BackendOrderItem[] | undefined): OrderItem[] {
  return (items ?? []).map((i) => ({
    productId: String(i.productId),
    productName: i.productName,
    quantity: i.quantity,
    unitPrice: num(i.unitPrice),
  }))
}

function mapPaymentToFrontend(method?: BackendPaymentMethod): Order['paymentMethod'] {
  if (method === 'BANK') return 'bank'
  if (method === 'MOMO') return 'card'
  if (method === 'COD') return 'cod'
  return undefined
}

function formatTimestamp(createdAt?: string | null): string {
  if (createdAt == null || createdAt === '') {
    return new Date().toISOString()
  }
  const s = String(createdAt)
  return s.includes('T') ? s : `${s}T00:00:00.000Z`
}

export function mapBackendOrder(
  o: BackendOrderResponse,
  extras?: {
    customerId?: string
    customerName?: string
    shippingAddress?: string
    paymentMethod?: BackendPaymentMethod
  },
): Order {
  const ts = formatTimestamp(o.createdAt)
  return {
    id: String(o.id),
    customerId: extras?.customerId ?? '',
    customerName: extras?.customerName ?? '',
    items: mapItems(o.items),
    total: num(o.total),
    status: mapStatus(o.status),
    shippingAddress: extras?.shippingAddress ?? '',
    paymentMethod: mapPaymentToFrontend(extras?.paymentMethod),
    createdAt: ts,
    updatedAt: ts,
  }
}

export function toBackendPayment(method: 'cod' | 'bank' | 'card'): BackendPaymentMethod {
  if (method === 'bank') return 'BANK'
  if (method === 'card') return 'MOMO'
  return 'COD'
}

export async function createOrder(
  shippingAddress: string,
  paymentMethod: BackendPaymentMethod,
): Promise<Order> {
  const data = await http.post<BackendOrderResponse>(apiPaths.orders.list, {
    shippingAddress,
    paymentMethod,
  })
  return mapBackendOrder(data, { shippingAddress, paymentMethod })
}

export async function listMyOrders(page = 0, size = 20): Promise<Order[]> {
  const data = await http.get<SpringPage<BackendOrderResponse>>(
    `${apiPaths.orders.list}?page=${page}&size=${size}`,
  )
  return data.content.map((o) => mapBackendOrder(o))
}

export async function getOrderById(id: string): Promise<Order | null> {
  const data = await http.get<BackendOrderDetailResponse>(apiPaths.orders.byId(id))
  if (!data?.order) return null
  return mapBackendOrder(data.order, {
    shippingAddress: data.shippingAddress,
    paymentMethod: data.paymentMethod,
  })
}

export async function cancelOrder(id: string): Promise<void> {
  await http.put<void>(`${apiPaths.orders.byId(id)}/cancel`)
}
