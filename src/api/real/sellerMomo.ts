import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'

export interface SellerMomoSettings {
  momoPhone?: string | null
  momoQrUrl?: string | null
  configured: boolean
}

export interface SellerMomoPublic extends SellerMomoSettings {
  sellerId: number
  storeName?: string | null
}

export interface UpdateSellerMomoPayload {
  momoPhone?: string | null
  momoQrUrl?: string | null
}

export async function getMyMomoSettings(): Promise<SellerMomoSettings> {
  return http.get<SellerMomoSettings>(apiPaths.seller.myMomo)
}

export async function updateMyMomoSettings(
  payload: UpdateSellerMomoPayload,
): Promise<SellerMomoSettings> {
  return http.put<SellerMomoSettings>(apiPaths.seller.myMomo, payload)
}

export async function getSellerMomoPublic(sellerId: string | number): Promise<SellerMomoPublic> {
  return http.get<SellerMomoPublic>(apiPaths.seller.publicMomo(sellerId))
}
