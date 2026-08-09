import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'

export type BackendPaymentMethod = 'MOMO' | 'MOMO_QR' | 'VNPAY'
/** Legacy values still may appear in older mock overlays */
export type LegacyBackendPaymentMethod = BackendPaymentMethod | 'COD' | 'BANK'

export type BackendPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface PaymentInfo {
  id: string
  orderId: string
  paymentMethod: LegacyBackendPaymentMethod
  amount: number
  status: BackendPaymentStatus
  transactionId?: string
  currency?: string
  redirectUrl?: string
  gatewayName?: string
}

interface BackendPayment {
  id: number
  orderId?: number
  paymentMethod: LegacyBackendPaymentMethod
  amount: number | string
  status: BackendPaymentStatus
  transactionId?: string
  currency?: string
  redirectUrl?: string
  gatewayName?: string
}

function num(v: number | string): number {
  return typeof v === 'number' ? v : Number(v)
}

function mapPayment(data: BackendPayment, orderIdFallback?: string): PaymentInfo {
  return {
    id: String(data.id),
    orderId: String(data.orderId ?? orderIdFallback ?? ''),
    paymentMethod: data.paymentMethod,
    amount: num(data.amount),
    status: data.status,
    transactionId: data.transactionId,
    currency: data.currency,
    redirectUrl: data.redirectUrl,
    gatewayName: data.gatewayName,
  }
}

export function mapPaymentMethodLabel(method?: LegacyBackendPaymentMethod | string): string {
  if (method === 'VNPAY' || method === 'BANK') return 'VNPay'
  if (method === 'MOMO') return 'Ví MoMo'
  if (method === 'MOMO_QR') return 'Chuyển MoMo tới shop'
  if (method === 'COD') return 'Thanh toán khi nhận hàng (COD)'
  return '—'
}

export async function getPaymentByOrder(orderId: string): Promise<PaymentInfo | null> {
  try {
    const data = await http.get<BackendPayment>(apiPaths.payments.byOrder(orderId))
    return mapPayment(data, orderId)
  } catch {
    return null
  }
}

/** Initiate MoMo / VNPay — returns redirectUrl to open gateway */
export async function payOrder(
  orderId: string,
  paymentMethod: BackendPaymentMethod,
): Promise<PaymentInfo> {
  const data = await http.post<BackendPayment>(
    apiPaths.payments.payOrder(orderId),
    { paymentMethod },
    { timeoutMs: 12_000 },
  )
  return mapPayment(data, orderId)
}
