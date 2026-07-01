import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'

export type BackendPaymentMethod = 'COD' | 'BANK' | 'MOMO'
export type BackendPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface PaymentInfo {
  id: string
  orderId: string
  paymentMethod: BackendPaymentMethod
  amount: number
  status: BackendPaymentStatus
  transactionId?: string
  currency?: string
}

interface BackendPayment {
  id: number
  orderId?: number
  paymentMethod: BackendPaymentMethod
  amount: number | string
  status: BackendPaymentStatus
  transactionId?: string
  currency?: string
}

function num(v: number | string): number {
  return typeof v === 'number' ? v : Number(v)
}

export function mapPaymentMethodLabel(method?: BackendPaymentMethod): string {
  if (method === 'BANK') return 'Chuyển khoản ngân hàng'
  if (method === 'MOMO') return 'Ví MoMo / thẻ'
  return 'Thanh toán khi nhận hàng (COD)'
}

export async function getPaymentByOrder(orderId: string): Promise<PaymentInfo | null> {
  try {
    const data = await http.get<BackendPayment>(apiPaths.payments.byOrder(orderId))
    return {
      id: String(data.id),
      orderId: String(data.orderId ?? orderId),
      paymentMethod: data.paymentMethod,
      amount: num(data.amount),
      status: data.status,
      transactionId: data.transactionId,
      currency: data.currency,
    }
  } catch {
    return null
  }
}
