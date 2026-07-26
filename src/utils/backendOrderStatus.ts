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

/** Trạng thái tiếp theo seller/manager có thể chọn */
export function nextBackendStatuses(rawStatus?: string): BackendOrderStatus[] {
  switch (rawStatus) {
    case 'PENDING':
      return ['PROCESSING', 'CANCELLED']
    case 'PAID':
      return ['PROCESSING']
    case 'PROCESSING':
      return ['SHIPPING']
    case 'SHIPPING':
      return ['DELIVERED']
    default:
      return []
  }
}
