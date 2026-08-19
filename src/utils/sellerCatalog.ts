import { apiConfig } from '@/api/config'
import { productApi, type CatalogSource } from '@/api/services'
import type { Product } from '@/types'

export interface SellerCatalogLoadResult {
  products: Product[]
  catalogSource: CatalogSource
  error: string
}

function uniqueById(list: Product[]): Product[] {
  const seen = new Set<string>()
  const out: Product[] = []
  for (const p of list) {
    const id = String(p.id)
    if (seen.has(id)) continue
    seen.add(id)
    out.push(p)
  }
  return out
}

/**
 * Load seller products for DSS forms.
 * In real-API mode, never return mock catalog (mock IDs break DSS POSTs).
 * Fallback: nếu filter sellerId API trống, lấy catalog rộng hơn rồi lọc theo seller.
 */
export async function loadSellerCatalogForDss(opts: {
  sellerId?: string
  withStock?: boolean
}): Promise<SellerCatalogLoadResult> {
  const sellerId = opts.sellerId?.trim()
  const meta = await productApi.listWithMeta({
    sellerId,
    withStock: opts.withStock ?? false,
    size: 48,
  })

  if (apiConfig.useRealProducts && meta.catalogSource === 'mock') {
    return {
      products: [],
      catalogSource: 'mock',
      error: meta.backendUnreachable
        ? 'Không kết nối được máy chủ. Thử lại sau vài phút.'
        : 'Không tải được sản phẩm. Đăng nhập lại rồi tải lại trang.',
    }
  }

  let products = uniqueById(meta.products)

  // Một lần gọi phụ tối đa — tránh N lần list làm DSS >2s
  if (!products.length && sellerId) {
    const broad = await productApi.listWithMeta({
      withStock: false,
      size: 60,
    })
    if (!(apiConfig.useRealProducts && broad.catalogSource === 'mock')) {
      const key = sellerId.toLowerCase()
      products = uniqueById(
        broad.products.filter((p) => {
          const sid = String(p.sellerId ?? '').toLowerCase()
          const email = String(p.sellerEmail ?? '').toLowerCase()
          return sid === key || email === key || email.includes(key)
        }),
      )
    }
  }

  return {
    products,
    catalogSource: meta.catalogSource,
    error: products.length
      ? ''
      : 'Bạn chưa có sản phẩm nào để tạo dự báo. Thêm SP tại Quản lý sản phẩm trước.',
  }
}
