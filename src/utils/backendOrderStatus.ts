export type BackendOrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'

export const BACKEND_STATUS_LABEL: Record<BackendOrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  PAID: 'Đã thanh toán',
  PROCESSING: 'Đang xử lý',
  SHIPPING: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Hoàn tiền',
}

export function backendStatusLabel(status: string): string {
  return BACKEND_STATUS_LABEL[status as BackendOrderStatus] ?? status
}

const STATUS_FLOW: BackendOrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPING',
  'DELIVERED',
]

const TERMINAL_RAW = new Set<BackendOrderStatus>(['DELIVERED', 'CANCELLED', 'REFUNDED'])

function statusRank(status: BackendOrderStatus): number {
  const idx = STATUS_FLOW.indexOf(status)
  return idx >= 0 ? idx : -1
}

function normalizeRaw(rawStatus?: string): BackendOrderStatus {
  const upper = (rawStatus ?? 'PENDING').toUpperCase() as BackendOrderStatus
  return BACKEND_STATUS_LABEL[upper] ? upper : 'PENDING'
}

/** Trạng thái tiếp theo seller/manager có thể chọn (1 bước — giữ cho tương thích). */
export function nextBackendStatuses(rawStatus?: string): BackendOrderStatus[] {
  switch (rawStatus) {
    case 'PENDING':
      return ['PROCESSING', 'CANCELLED']
    case 'PAID':
      return ['PROCESSING', 'CANCELLED']
    case 'PROCESSING':
      return ['SHIPPING', 'CANCELLED']
    case 'SHIPPING':
      return ['DELIVERED']
    default:
      return []
  }
}

/**
 * Mọi trạng thái có thể chọn trong dropdown (nhảy tới bước sau hoặc hủy).
 * Khác với nextBackendStatuses — không bắt cập nhật từng bước một.
 */
export function selectableBackendStatuses(
  rawStatus?: string,
  _role: 'seller' | 'manager' = 'seller',
): BackendOrderStatus[] {
  const current = normalizeRaw(rawStatus)
  if (TERMINAL_RAW.has(current)) return []

  const options: BackendOrderStatus[] = []
  const currentRank = statusRank(current)

  for (const status of STATUS_FLOW) {
    if (statusRank(status) > currentRank) options.push(status)
  }

  if (current !== 'CANCELLED') options.push('CANCELLED')

  return options
}
