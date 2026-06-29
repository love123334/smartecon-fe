import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { Product } from '@/types'

export interface SpringPage<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}

export interface BackendProductResponse {
  id: number
  name: string
  slug: string
  price: number | string
  status: string
  categoryId?: number
  categoryName?: string
  sellerStoreName?: string
  createdAt?: string
}

export interface BackendProductImage {
  id: number
  imageUrl: string
  isPrimary: boolean
}

export interface BackendProductDetail extends BackendProductResponse {
  description?: string
  costPrice?: number | string
  sellerId?: number
  updatedAt?: string
  images?: BackendProductImage[]
}

function num(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback
  return typeof v === 'number' ? v : Number(v)
}

export function mapProductSummary(p: BackendProductResponse): Product {
  return {
    id: String(p.id),
    name: p.name,
    description: '',
    price: num(p.price),
    stock: 50,
    category: p.categoryName ?? 'Khác',
    imageUrl: `https://picsum.photos/seed/prod-${p.id}/400/400`,
    sellerId: '',
    shopName: p.sellerStoreName ?? 'SEDSP Official',
    shopLocation: 'TP.HCM',
    rating: 4.5,
    soldCount: 0,
    createdAt: p.createdAt ?? new Date().toISOString(),
  }
}

export function mapProductDetail(p: BackendProductDetail): Product {
  const primary = p.images?.find((i) => i.isPrimary) ?? p.images?.[0]
  return {
    ...mapProductSummary(p),
    description: p.description ?? '',
    imageUrl: primary?.imageUrl ?? `https://picsum.photos/seed/prod-${p.id}/400/400`,
    sellerId: p.sellerId != null ? String(p.sellerId) : '',
    originalPrice: p.costPrice ? Math.round(num(p.price) * 1.12) : undefined,
  }
}

export async function listProducts(params?: {
  q?: string
  categoryId?: number
  sellerId?: number
  page?: number
  size?: number
}): Promise<Product[]> {
  const query = new URLSearchParams()
  if (params?.q) query.set('keyword', params.q)
  if (params?.categoryId) query.set('categoryId', String(params.categoryId))
  if (params?.sellerId) query.set('sellerId', String(params.sellerId))
  query.set('page', String(params?.page ?? 0))
  query.set('size', String(params?.size ?? 50))

  const path = `${apiPaths.products.list}?${query}`
  const page = await http.get<SpringPage<BackendProductResponse>>(path)
  return page.content.map(mapProductSummary)
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const data = await http.get<BackendProductDetail>(apiPaths.products.byId(id))
    return mapProductDetail(data)
  } catch {
    return null
  }
}
