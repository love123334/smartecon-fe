import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'

export type VoucherDiscountType = 'PERCENTAGE' | 'FIXED'
export type VoucherScope = 'PLATFORM' | 'SHOP'
export type VoucherAppliesTo = 'ALL_PRODUCTS' | 'SELECTED_PRODUCTS'
export type VoucherRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Voucher {
  id: number
  code: string
  name: string
  description: string | null
  discountType: VoucherDiscountType
  discountValue: number
  scope: VoucherScope
  sellerId: number | null
  sellerName: string | null
  appliesTo: VoucherAppliesTo
  minimumOrderAmount: number
  maximumDiscountAmount: number | null
  usageLimit: number | null
  usedCount: number
  startsAt: string
  endsAt: string
  isActive: boolean
  productIds: number[]
  requestId: number | null
  createdAt: string
}

export interface VoucherRequest {
  id: number
  sellerId: number
  sellerName: string
  code: string
  name: string
  description: string | null
  discountType: VoucherDiscountType
  discountValue: number
  appliesTo: VoucherAppliesTo
  minimumOrderAmount: number
  maximumDiscountAmount: number | null
  usageLimit: number | null
  startsAt: string
  endsAt: string
  status: VoucherRequestStatus
  managerNote: string | null
  voucherId: number | null
  productIds: number[]
  createdAt: string
  reviewedAt: string | null
}

export interface ValidateVoucherResult {
  valid: boolean
  message: string
  voucherId?: number
  code?: string
  name?: string
  description?: string
  discountType?: VoucherDiscountType
  discountValue?: number
  scope?: VoucherScope
  sellerId?: number | null
  sellerName?: string | null
  discountAmount?: number
  eligibleSubtotal?: number
}

export interface UpsertVoucherPayload {
  code: string
  name: string
  description?: string
  discountType: VoucherDiscountType
  discountValue: number
  scope: VoucherScope
  sellerId?: number
  appliesTo: VoucherAppliesTo
  minimumOrderAmount?: number
  maximumDiscountAmount?: number
  usageLimit?: number
  startsAt: string
  endsAt: string
  productIds?: number[]
}

export interface SellerVoucherRequestPayload {
  code: string
  name: string
  description?: string
  discountType: VoucherDiscountType
  discountValue: number
  appliesTo: VoucherAppliesTo
  minimumOrderAmount?: number
  maximumDiscountAmount?: number
  usageLimit?: number
  startsAt: string
  endsAt: string
  productIds?: number[]
}

export function listPublicVouchers(sellerId?: number) {
  const qs = sellerId != null ? `?sellerId=${sellerId}` : ''
  return http.get<Voucher[]>(`${apiPaths.vouchers.public}${qs}`)
}

export function validateVoucher(code: string, productIds?: number[]) {
  return http.post<ValidateVoucherResult>(apiPaths.vouchers.validate, {
    code,
    productIds: productIds ?? [],
  })
}

export function listManagerVouchers() {
  return http.get<Voucher[]>(apiPaths.vouchers.manager.list)
}

export function createManagerVoucher(payload: UpsertVoucherPayload) {
  return http.post<Voucher>(apiPaths.vouchers.manager.list, payload)
}

export function setVoucherActive(id: number, active: boolean) {
  return http.patch<Voucher>(apiPaths.vouchers.manager.active(String(id)), { active })
}

export function listPendingVoucherRequests() {
  return http.get<VoucherRequest[]>(apiPaths.vouchers.manager.requests)
}

export function approveVoucherRequest(id: number, managerNote?: string) {
  return http.post<VoucherRequest>(apiPaths.vouchers.manager.approve(String(id)), { managerNote })
}

export function rejectVoucherRequest(id: number, managerNote?: string) {
  return http.post<VoucherRequest>(apiPaths.vouchers.manager.reject(String(id)), { managerNote })
}

export function listSellerVoucherRequests() {
  return http.get<VoucherRequest[]>(apiPaths.vouchers.seller.requests)
}

export function createSellerVoucherRequest(payload: SellerVoucherRequestPayload) {
  return http.post<VoucherRequest>(apiPaths.vouchers.seller.requests, payload)
}
