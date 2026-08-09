import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { BackendOrderStatus } from '@/utils/backendOrderStatus'
import type { SpringPage } from '@/api/real/products'
import type { MomoTransferInfo, Order, OrderItem, OrderStatus } from '@/types'

export type { BackendOrderStatus }
export type BackendPaymentMethod = 'MOMO' | 'MOMO_QR' | 'VNPAY' | 'COD' | 'BANK'

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
  customerId?: number
  customerName?: string
  subtotal?: number | string
  shippingFee?: number | string
  discount?: number | string
  total: number | string
  createdAt?: string | null
  items?: BackendOrderItem[]
}

export interface BackendMomoTransferInfo {
  amount: number | string
  transferNote: string
  sellerMomoPhone?: string | null
  sellerMomoQrUrl?: string | null
  sellerStoreName?: string | null
  configured?: boolean
}

export interface BackendOrderDetailResponse {
  order: BackendOrderResponse
  shippingAddress: string
  paymentMethod?: BackendPaymentMethod
  momoTransfer?: BackendMomoTransferInfo | null
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
  if (method === 'VNPAY' || method === 'BANK') return 'vnpay'
  if (method === 'MOMO') return 'momo'
  if (method === 'MOMO_QR') return 'momo_qr'
  if (method === 'COD') return 'cod'
  return undefined
}

function mapMomoTransfer(raw?: BackendMomoTransferInfo | null): MomoTransferInfo | undefined {
  if (!raw) return undefined
  return {
    amount: num(raw.amount),
    transferNote: raw.transferNote,
    sellerMomoPhone: raw.sellerMomoPhone ?? undefined,
    sellerMomoQrUrl: raw.sellerMomoQrUrl ?? undefined,
    sellerStoreName: raw.sellerStoreName ?? undefined,
    configured: raw.configured ?? true,
  }
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
    customerId: extras?.customerId ?? (o.customerId != null ? String(o.customerId) : ''),
    customerName: extras?.customerName ?? o.customerName ?? '',
    items: mapItems(o.items),
    total: num(o.total),
    status: mapStatus(o.status),
    rawStatus: o.status,
    shippingAddress: extras?.shippingAddress ?? '',
    paymentMethod: mapPaymentToFrontend(extras?.paymentMethod),
    createdAt: ts,
    updatedAt: ts,
  }
}

export function toBackendPayment(
  method: 'momo' | 'momo_qr' | 'vnpay' | 'cod' | 'bank' | 'card',
): 'MOMO' | 'MOMO_QR' | 'VNPAY' | 'COD' {
  if (method === 'cod') return 'COD'
  if (method === 'momo_qr') return 'MOMO_QR'
  if (method === 'momo' || method === 'card') return 'MOMO'
  return 'VNPAY'
}

export async function createOrder(
  shippingAddress: string,
  paymentMethod: 'MOMO' | 'MOMO_QR' | 'VNPAY' | 'COD',
  voucherCode?: string,
): Promise<Order> {
  const data = await http.post<BackendOrderResponse>(apiPaths.orders.list, {
    shippingAddress,
    paymentMethod,
    voucherCode: voucherCode?.trim() || undefined,
  })
  return mapBackendOrder(data, { shippingAddress, paymentMethod })
}

export async function listMyOrders(page = 0, size = 20): Promise<Order[]> {
  const data = await http.get<SpringPage<BackendOrderResponse>>(
    `${apiPaths.orders.list}?page=${page}&size=${size}`,
  )
  return (data?.content ?? []).map((o) => mapBackendOrder(o))
}

export async function getOrderById(id: string): Promise<Order | null> {
  const data = await http.get<BackendOrderDetailResponse>(apiPaths.orders.byId(id))
  if (!data?.order) return null
  const order = mapBackendOrder(data.order, {
    shippingAddress: data.shippingAddress,
    paymentMethod: data.paymentMethod,
  })
  const transfer = mapMomoTransfer(data.momoTransfer)
  return transfer ? { ...order, momoTransfer: transfer } : order
}

export async function confirmMomoTransfer(id: string): Promise<Order> {
  const data = await http.post<BackendOrderResponse>(
    `${apiPaths.orders.byId(id)}/confirm-momo`,
    {},
  )
  return mapBackendOrder(data)
}

export async function cancelOrder(id: string): Promise<void> {
  await http.put<void>(`${apiPaths.orders.byId(id)}/cancel`)
}

export async function listSellerOrders(page = 0, size = 20): Promise<Order[]> {
  const data = await http.get<SpringPage<BackendOrderResponse>>(
    `${apiPaths.orders.seller}?page=${page}&size=${size}`,
    { timeoutMs: 20_000 },
  )
  return (data?.content ?? []).map((o) => mapBackendOrder(o))
}

export async function listManagedOrders(page = 0, size = 100): Promise<Order[]> {
  const data = await http.get<SpringPage<BackendOrderResponse>>(
    `${apiPaths.orders.manage}?page=${page}&size=${size}`,
    { timeoutMs: 20_000 },
  )
  return (data?.content ?? []).map((o) => mapBackendOrder(o))
}

export async function updateOrderStatus(
  id: string,
  status: BackendOrderStatus,
  note?: string,
): Promise<Order> {
  const data = await http.put<BackendOrderResponse>(
    apiPaths.orders.status(id),
    {
      status,
      note: note ?? undefined,
    },
    { timeoutMs: 10_000 },
  )
  return mapBackendOrder(data)
}
