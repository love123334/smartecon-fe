import type { OrderStatus } from '@/types'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
}

export function orderStatusLabel(status: OrderStatus | string): string {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status
}
