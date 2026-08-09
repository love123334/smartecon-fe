import type { Order, OrderStatus } from '@/types'
import type { BackendOrderStatus } from '@/utils/backendOrderStatus'

const STORAGE_KEY = 'sedsp_order_status_overlay_v1'

export interface OrderStatusOverlay {
  orderId: string
  status: OrderStatus
  rawStatus: BackendOrderStatus
  note?: string
  updatedAt: string
  updatedByRole?: string
  /** Snapshot fields so seller/manager vẫn theo dõi được khi API thiếu chi tiết */
  customerName?: string
  total?: number
  shippingAddress?: string
  items?: Order['items']
  createdAt?: string
}

type OverlayMap = Record<string, OrderStatusOverlay>

function readAll(): OverlayMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as OverlayMap
  } catch {
    return {}
  }
}

function writeAll(map: OverlayMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function getOrderOverlay(orderId: string): OrderStatusOverlay | undefined {
  return readAll()[orderId]
}

export function listOrderOverlays(): OrderStatusOverlay[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveOrderOverlay(
  patch: Omit<OrderStatusOverlay, 'updatedAt'> & { updatedAt?: string },
): OrderStatusOverlay {
  const map = readAll()
  const prev = map[patch.orderId]
  const next: OrderStatusOverlay = {
    ...prev,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  }
  map[patch.orderId] = next
  writeAll(map)
  return next
}

const RAW_TO_FE: Record<BackendOrderStatus, OrderStatus> = {
  PENDING: 'pending',
  PAID: 'confirmed',
  PROCESSING: 'confirmed',
  SHIPPING: 'shipping',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'cancelled',
}

export function frontendStatusFromRaw(raw: BackendOrderStatus): OrderStatus {
  return RAW_TO_FE[raw] ?? 'pending'
}

/** Áp overlay lên 1 đơn — không để overlay cũ kéo lùi trạng thái đã có trên API. */
export function applyOrderOverlay(order: Order): Order {
  const o = getOrderOverlay(order.id)
  if (!o) return order

  const rank: Record<OrderStatus, number> = {
    pending: 1,
    confirmed: 2,
    shipping: 3,
    delivered: 4,
    cancelled: 0,
  }
  const apiRank = rank[order.status] ?? 0
  const overlayRank = rank[o.status] ?? 0
  // Overlay chỉ thắng khi tiến xa hơn API (vd. seller cập nhật offline), không regress DELIVERED → PENDING
  const useOverlayStatus =
    overlayRank > apiRank ||
    (o.status === 'cancelled' &&
      order.status !== 'delivered' &&
      order.status !== 'shipping' &&
      Date.parse(o.updatedAt) >= Date.parse(order.updatedAt || order.createdAt || ''))

  return {
    ...order,
    status: useOverlayStatus ? o.status : order.status,
    rawStatus: useOverlayStatus ? o.rawStatus : (order.rawStatus ?? o.rawStatus),
    updatedAt: useOverlayStatus
      ? o.updatedAt
      : order.updatedAt || o.updatedAt || order.createdAt,
    customerName: order.customerName || o.customerName || '',
    shippingAddress: order.shippingAddress || o.shippingAddress || '',
    items: order.items?.length ? order.items : o.items ?? order.items,
    total: order.total || o.total || 0,
  }
}

export function applyOrderOverlays(orders: Order[]): Order[] {
  return orders.map(applyOrderOverlay)
}

/** Đơn chỉ có trong overlay (seller cập nhật khi list API thiếu) */
export function overlayOnlyOrders(excludeIds: Set<string>): Order[] {
  return listOrderOverlays()
    .filter((o) => !excludeIds.has(o.orderId))
    .map(
      (o): Order => ({
        id: o.orderId,
        customerId: '',
        customerName: o.customerName ?? '',
        items: o.items ?? [],
        total: o.total ?? 0,
        status: o.status,
        rawStatus: o.rawStatus,
        shippingAddress: o.shippingAddress ?? '',
        createdAt: o.createdAt ?? o.updatedAt,
        updatedAt: o.updatedAt,
      }),
    )
}

export function seedPendingOverlay(order: Order, role = 'customer') {
  saveOrderOverlay({
    orderId: order.id,
    status: order.status || 'pending',
    rawStatus: (order.rawStatus as BackendOrderStatus) || 'PENDING',
    note: 'Đơn mới — chờ người bán xác nhận',
    updatedByRole: role,
    customerName: order.customerName,
    total: order.total,
    shippingAddress: order.shippingAddress,
    items: order.items,
    createdAt: order.createdAt,
  })
}
