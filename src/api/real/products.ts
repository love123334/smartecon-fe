import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { Product } from '@/types'
import { repairProductImageUrl } from '@/utils/productImage'

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
  sellerId?: number
  sellerStoreName?: string
  sellerEmail?: string
  sellerPhone?: string
  primaryImageUrl?: string | null
  availableQuantity?: number | null
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
  sellerStoreName?: string
  sellerEmail?: string
  sellerPhone?: string
  updatedAt?: string
  images?: BackendProductImage[]
}

function num(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback
  return typeof v === 'number' ? v : Number(v)
}

/** Stable placeholder set (3) when a product has no/insufficient images */
export function placeholderImages(seed: string | number): string[] {
  const s = encodeURIComponent(String(seed))
  // Prefer Unsplash (stable) over picsum — fewer CDN / HEAD quirks
  return [
    `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80&sig=${s}-a`,
    `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80&sig=${s}-b`,
    `https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80&sig=${s}-c`,
  ]
}

export function ensureThreeImages(urls: string[], seed: string | number): string[] {
  const cleaned = urls.map((u) => u.trim()).filter(Boolean)
  if (cleaned.length >= 3) return cleaned.slice(0, 5)
  const pads = placeholderImages(seed)
  const out = [...cleaned]
  for (const p of pads) {
    if (out.length >= 3) break
    if (!out.includes(p)) out.push(p)
  }
  while (out.length < 3) {
    out.push(pads[out.length % pads.length])
  }
  return out
}

export function mapProductSummary(p: BackendProductResponse): Product {
  const category = p.categoryName ?? 'Khác'
  const placeholders = placeholderImages(p.id)
  const rawPrimary = (p.primaryImageUrl && p.primaryImageUrl.trim()) || placeholders[0]
  const imageUrl = repairProductImageUrl(rawPrimary, { seed: p.id, category })
  return {
    id: String(p.id),
    name: p.name,
    description: '',
    price: num(p.price),
    stock: p.availableQuantity != null ? Number(p.availableQuantity) : 0,
    category,
    imageUrl,
    imageUrls: ensureThreeImages([imageUrl], p.id).map((u) =>
      repairProductImageUrl(u, { seed: p.id, category }),
    ),
    sellerId: p.sellerId != null ? String(p.sellerId) : '',
    sellerEmail: p.sellerEmail,
    sellerPhone: p.sellerPhone,
    shopName: p.sellerStoreName ?? 'Cửa hàng SEDSP',
    shopLocation: 'TP.HCM',
    rating: 4.5,
    soldCount: 0,
    createdAt: p.createdAt ?? new Date().toISOString(),
  }
}

export function mapProductDetail(p: BackendProductDetail): Product {
  const category = p.categoryName ?? 'Khác'
  const ordered = [...(p.images ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  const urls = ensureThreeImages(
    ordered.map((i) => repairProductImageUrl(i.imageUrl, { seed: p.id, category })),
    p.id,
  ).map((u) => repairProductImageUrl(u, { seed: p.id, category }))
  const primary = urls[0]
  return {
    ...mapProductSummary(p),
    description: p.description ?? '',
    imageUrl: primary,
    imageUrls: urls,
    sellerId: p.sellerId != null ? String(p.sellerId) : '',
    sellerEmail: p.sellerEmail,
    sellerPhone: p.sellerPhone,
    shopName: p.sellerStoreName ?? 'Cửa hàng SEDSP',
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

export interface ProductImageInput {
  imageUrl: string
  publicId?: string
  isPrimary?: boolean
}

export interface ProductWriteInput {
  name: string
  description: string
  price: number
  categoryId?: number
  /** @deprecated prefer images[] */
  imageUrl?: string
  imagePublicId?: string
  images?: ProductImageInput[]
  stock?: number
}

function buildImagePayload(
  input: Pick<ProductWriteInput, 'images' | 'imageUrl' | 'imagePublicId'>,
  seed: string | number,
): ProductImageInput[] {
  const fromList = (input.images ?? [])
    .map((img) => ({
      imageUrl: (img.imageUrl || '').trim(),
      publicId: img.publicId?.trim() || undefined,
      isPrimary: Boolean(img.isPrimary),
    }))
    .filter((img) => img.imageUrl)

  if (fromList.length) {
    if (!fromList.some((i) => i.isPrimary)) fromList[0].isPrimary = true
    // Keep 3–5; pad with Unsplash if seller uploaded fewer than 3
    const pads = placeholderImages(seed)
    const out = [...fromList]
    let i = 0
    while (out.length < 3) {
      const url = pads[i % pads.length]
      if (!out.some((x) => x.imageUrl === url)) {
        out.push({
          imageUrl: url,
          publicId: `pad-${seed}-${out.length}`,
          isPrimary: false,
        })
      }
      i++
      if (i > 10) break
    }
    return out.slice(0, 5)
  }

  const pads = placeholderImages(seed)
  const primaryUrl = input.imageUrl || pads[0]
  const primaryId = input.imagePublicId || `ext-${Date.now()}`
  return [
    { imageUrl: primaryUrl, publicId: primaryId, isPrimary: true },
    { imageUrl: pads[1], publicId: `${primaryId}-2`, isPrimary: false },
    { imageUrl: pads[2], publicId: `${primaryId}-3`, isPrimary: false },
  ]
}

export async function createProduct(input: ProductWriteInput): Promise<Product> {
  const body: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    price: input.price,
    status: 'ACTIVE',
  }
  if (input.categoryId) body.categoryId = input.categoryId
  const images = buildImagePayload(input, input.name || Date.now())
  body.images = images.map((img) => ({
    imageUrl: img.imageUrl,
    publicId: img.publicId,
    isPrimary: Boolean(img.isPrimary),
  }))
  const data = await http.post<BackendProductResponse>(apiPaths.products.list, body)
  return mapProductSummary({ ...data, primaryImageUrl: images[0]?.imageUrl })
}

export async function updateProduct(
  id: string,
  input: Partial<ProductWriteInput>,
): Promise<Product> {
  const body: Record<string, unknown> = {}
  if (input.name != null) body.name = input.name
  if (input.description != null) body.description = input.description
  if (input.price != null) body.price = input.price
  if (input.categoryId != null) body.categoryId = input.categoryId

  const hasImages =
    (input.images && input.images.length > 0) || Boolean(input.imageUrl?.trim())
  if (hasImages) {
    const images = buildImagePayload(
      {
        images: input.images,
        imageUrl: input.imageUrl,
        imagePublicId: input.imagePublicId,
      },
      id,
    )
    body.images = images.map((img) => ({
      imageUrl: img.imageUrl,
      publicId: img.publicId,
      isPrimary: Boolean(img.isPrimary),
    }))
  }

  const data = await http.put<BackendProductResponse>(apiPaths.products.byId(id), body)
  const primary =
    input.images?.[0]?.imageUrl || input.imageUrl || data.primaryImageUrl
  return mapProductSummary({
    ...data,
    primaryImageUrl: primary,
  })
}

export async function deleteProduct(id: string): Promise<void> {
  await http.delete<void>(apiPaths.products.byId(id))
}
