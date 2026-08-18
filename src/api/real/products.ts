import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { Product, ProductAttribute } from '@/types'
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
  averageRating?: number | null
  reviewCount?: number | null
  soldCount?: number | null
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
  attributes?: BackendProductAttribute[]
}

export interface BackendProductAttribute {
  id: number
  attributeName: string
  attributeValue: string
}

export interface ProductUnitEconomicsApi {
  id: number
  name: string
  price: number
  costPrice: number
  sellerId: number
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

const ATTRIBUTE_LABEL_VI: Record<string, string> = {
  Brand: 'Thương hiệu',
  Origin: 'Xuất xứ',
  Warranty: 'Bảo hành',
  Compatibility: 'Tương thích',
  Material: 'Chất liệu',
  Size: 'Kích cỡ',
  'Skin Type': 'Loại da',
  Usage: 'Công dụng',
  Supplier: 'Nhà cung cấp',
  'Nhà cung cấp': 'Nhà cung cấp',
}

function isBadAttributeValue(name: string, value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return true
  if (/vnshop|example\.com|localhost|changeme/.test(v)) return true
  if (/^https?:\/\//.test(v) && /supplier|nhà cung cấp|cung cấp/i.test(name)) return true
  return false
}

export function mapProductAttributes(
  attrs: BackendProductAttribute[] | undefined,
  shopName?: string,
): ProductAttribute[] {
  if (!attrs?.length) return []
  const out: ProductAttribute[] = []
  for (const a of attrs) {
    const name = a.attributeName?.trim()
    const value = a.attributeValue?.trim()
    if (!name || !value) continue
    if (isBadAttributeValue(name, value)) continue
    const label = ATTRIBUTE_LABEL_VI[name] ?? name
    let displayValue = value
    if (/supplier|nhà cung cấp|cung cấp/i.test(name) && shopName) {
      displayValue = shopName
    }
    out.push({ name: label, value: displayValue })
  }
  return out
}

export function mapProductSummary(p: BackendProductResponse): Product {
  const category = p.categoryName ?? 'Khác'
  const rawPrimary = (p.primaryImageUrl && p.primaryImageUrl.trim()) || ''
  const imageUrl = rawPrimary
    ? repairProductImageUrl(rawPrimary, { seed: p.id, category })
    : repairProductImageUrl(null, { seed: p.id, category })
  return {
    id: String(p.id),
    name: p.name,
    description: '',
    price: num(p.price),
    stock: p.availableQuantity != null ? Number(p.availableQuantity) : 0,
    category,
    imageUrl,
    imageUrls: imageUrl ? [imageUrl] : [],
    sellerId: p.sellerId != null ? String(p.sellerId) : '',
    sellerEmail: p.sellerEmail,
    sellerPhone: p.sellerPhone,
    shopName: p.sellerStoreName ?? 'Cửa hàng SEDSP',
    shopLocation: 'Việt Nam',
    rating: p.averageRating != null && p.averageRating > 0 ? Number(p.averageRating) : 0,
    reviewCount: p.reviewCount != null ? Number(p.reviewCount) : 0,
    soldCount: p.soldCount != null ? Number(p.soldCount) : 0,
    createdAt: p.createdAt ?? new Date().toISOString(),
  }
}

export function mapProductDetail(p: BackendProductDetail): Product {
  const category = p.categoryName ?? 'Khác'
  const ordered = [...(p.images ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  const fromApi = ordered
    .map((i) => repairProductImageUrl(i.imageUrl, { seed: p.id, category }))
    .filter(Boolean)
    .filter((u) => !/\/pad-|picsum\.photos|photo-1523275335684-37898b6baf30/i.test(u))
  const urls = fromApi.length ? fromApi.slice(0, 5) : []
  const primary =
    urls[0] ??
    (repairProductImageUrl(p.primaryImageUrl, { seed: p.id, category }) ||
      repairProductImageUrl(null, { seed: p.id, category }))
  const shopName = p.sellerStoreName ?? 'Cửa hàng SEDSP'
  return {
    ...mapProductSummary(p),
    description: p.description ?? '',
    imageUrl: primary,
    imageUrls: urls,
    sellerId: p.sellerId != null ? String(p.sellerId) : '',
    sellerEmail: p.sellerEmail,
    sellerPhone: p.sellerPhone,
    shopName,
    shopLocation: 'Việt Nam',
    attributes: mapProductAttributes(p.attributes, shopName),
  }
}

export interface ProductPageResult {
  products: Product[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

export type ProductCatalogSort =
  | 'popular'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'rating-desc'
  | 'rating-asc'

export async function listProductsPage(params?: {
  q?: string
  categoryId?: number
  sellerId?: number
  page?: number
  size?: number
  sort?: ProductCatalogSort
}): Promise<ProductPageResult> {
  const query = new URLSearchParams()
  if (params?.q) query.set('keyword', params.q)
  if (params?.categoryId) query.set('categoryId', String(params.categoryId))
  if (params?.sellerId) query.set('sellerId', String(params.sellerId))
  query.set('page', String(params?.page ?? 0))
  query.set('size', String(params?.size ?? 12))
  if (params?.sort) query.set('sort', params.sort)

  const path = `${apiPaths.products.list}?${query}`
  const page = await http.get<SpringPage<BackendProductResponse>>(path)
  return {
    products: page.content.map(mapProductSummary),
    totalElements: page.totalElements,
    totalPages: page.totalPages,
    page: page.number,
    size: page.size,
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

/** Dữ liệu thật tối thiểu cho calculator của Seller; không sinh giá/COGS dự phòng. */
export async function getProductUnitEconomicsById(
  id: string | number,
): Promise<ProductUnitEconomicsApi> {
  const product = await http.get<BackendProductDetail>(apiPaths.products.byId(String(id)))
  return {
    id: Number(product.id),
    name: product.name,
    price: num(product.price, Number.NaN),
    costPrice: num(product.costPrice, Number.NaN),
    sellerId: Number(product.sellerId),
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
  _seed: string | number,
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
    return fromList.slice(0, 5)
  }

  const primaryUrl = (input.imageUrl || '').trim()
  if (!primaryUrl) return []
  return [
    {
      imageUrl: primaryUrl,
      publicId: input.imagePublicId?.trim() || `ext-${Date.now()}`,
      isPrimary: true,
    },
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
  if (!images.length) {
    throw new Error('Cần ít nhất 1 ảnh sản phẩm')
  }
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
    if (!images.length) {
      throw new Error('Cần ít nhất 1 ảnh sản phẩm')
    }
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
