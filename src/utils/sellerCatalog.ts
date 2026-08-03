import { apiConfig } from '@/api/config'
import { productApi, type CatalogSource } from '@/api/services'
import type { Product } from '@/types'

export interface SellerCatalogLoadResult {
  products: Product[]
  catalogSource: CatalogSource
  error: string
}

/**
 * Load seller products for DSS forms.
 * In real-API mode, never return mock catalog (mock IDs break DSS POSTs).
 */
export async function loadSellerCatalogForDss(opts: {
  sellerId?: string
  withStock?: boolean
}): Promise<SellerCatalogLoadResult> {
  const meta = await productApi.listWithMeta({
    sellerId: opts.sellerId,
    withStock: opts.withStock ?? false,
    size: 100,
  })

  if (apiConfig.useRealProducts && meta.catalogSource === 'mock') {
    return {
      products: [],
      catalogSource: 'mock',
      error: meta.backendUnreachable
        ? 'Không kết nối được backend. Kiểm tra VITE_API_BASE_URL / VITE_BACKEND_ORIGIN rồi thử lại.'
        : 'Không tải được sản phẩm từ backend. Đăng nhập lại seller (JWT) rồi tải lại trang.',
    }
  }

  return {
    products: meta.products,
    catalogSource: meta.catalogSource,
    error: '',
  }
}
