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
 * Chỉ trả SP thuộc seller hiện tại (backend user id hoặc email khớp).
 */
export async function loadSellerCatalogForDss(opts: {
  sellerId?: string
  sellerEmail?: string
  withStock?: boolean
}): Promise<SellerCatalogLoadResult> {
  const rawSellerId = opts.sellerId?.trim() ?? ''
  const sellerEmail = opts.sellerEmail?.trim().toLowerCase() ?? ''
  const numericSellerId = /^\d+$/.test(rawSellerId) ? rawSellerId : ''

  const meta = await productApi.listWithMeta({
    sellerId: numericSellerId || undefined,
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

  if (!products.length && (numericSellerId || sellerEmail)) {
    const broad = await productApi.listWithMeta({
      withStock: false,
      size: 80,
    })
    if (!(apiConfig.useRealProducts && broad.catalogSource === 'mock')) {
      products = uniqueById(
        broad.products.filter((p) => {
          if (numericSellerId) {
            return String(p.sellerId ?? '') === numericSellerId
          }
          if (sellerEmail) {
            return String(p.sellerEmail ?? '').toLowerCase() === sellerEmail
          }
          return false
        }),
      )
    }
  }

  if (numericSellerId) {
    products = products.filter((p) => String(p.sellerId ?? '') === numericSellerId)
  } else if (sellerEmail) {
    products = products.filter(
      (p) => String(p.sellerEmail ?? '').toLowerCase() === sellerEmail,
    )
  }

  return {
    products,
    catalogSource: meta.catalogSource,
    error: products.length
      ? ''
      : 'Bạn chưa có sản phẩm nào để tạo dự báo. Thêm SP tại Quản lý sản phẩm trước.',
  }
}
