import { apiConfig } from '@/api/config'
import type { Category } from '@/api/real/categories'
import type { InventoryInfo } from '@/api/real/inventory'
import {
  adminApi,
  categoryApi,
  dssApi,
  orderApi,
  productApi,
  resolveCartLines,
  sellerApi,
} from '@/api/services'
import type {
  ChartPoint,
  DssInsight,
  Order,
  Product,
  ProductReview,
  RatingSummary,
  Recommendation,
  SystemMetric,
  User,
  UserRole,
} from '@/types'
import type { SalesPerformance, SellerDashboard } from '@/api/real/seller'

export interface ChatCartLine {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface ChatCategory {
  id: string
  name: string
  slug: string
  productCount: number
}

/** Dữ liệu bổ sung theo câu hỏi (reviews, tồn kho API, search…) */
export interface ChatEnrichment {
  productId?: string
  product?: Product | null
  ratingSummary?: RatingSummary | null
  reviews?: ProductReview[]
  inventory?: InventoryInfo | null
  searchResults?: Product[]
  focusedOrder?: Order | null
  categoryProducts?: Product[]
}

export interface ChatContext {
  role: UserRole
  userName?: string
  userId?: string
  products: Product[]
  orders: Order[]
  cartLines: ChatCartLine[]
  cartTotal: number
  cartItemCount: number
  categories: ChatCategory[]
  salesPerformance?: SalesPerformance | null
  sellerDashboard?: SellerDashboard | null
  sellerProducts: Product[]
  sellerInsights: DssInsight[]
  managerInsights: DssInsight[]
  categoryChart: ChartPoint[]
  users: User[]
  systemMetrics: SystemMetric[]
  recommendations: Recommendation[]
  /** api = catalog từ backend, mock = localStorage, hybrid = mock session + backend lỗi */
  dataSource: 'api' | 'mock' | 'hybrid'
  backendOnline: boolean
  catalogSource: 'backend' | 'mock'
  enrichment?: ChatEnrichment
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

async function loadProducts(sellerId?: string): Promise<{
  products: Product[]
  catalogSource: 'backend' | 'mock'
  backendUnreachable?: boolean
}> {
  try {
    return await productApi.listWithMeta({ sellerId, withStock: true })
  } catch {
    return { products: [], catalogSource: 'mock', backendUnreachable: true }
  }
}

function countProductsByCategory(products: Product[], cats: Category[]): ChatCategory[] {
  const counts = new Map<string, number>()
  for (const p of products) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1)
  }
  const fromApi = cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: counts.get(c.name) ?? 0,
  }))
  if (fromApi.length) return fromApi.sort((a, b) => b.productCount - a.productCount)

  return [...counts.entries()]
    .map(([name, productCount], i) => ({
      id: String(i + 1),
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      productCount,
    }))
    .sort((a, b) => b.productCount - a.productCount)
}

async function loadCart(userId?: string): Promise<{ lines: ChatCartLine[]; total: number }> {
  if (!userId) return { lines: [], total: 0 }
  return safe(async () => {
    const resolved = await resolveCartLines(userId)
    const lines: ChatCartLine[] = resolved.map((l) => ({
      productId: l.product.id,
      productName: l.product.name,
      quantity: l.quantity,
      unitPrice: l.product.price,
      subtotal: l.subtotal,
    }))
    const total = lines.reduce((s, l) => s + l.subtotal, 0)
    return { lines, total }
  }, { lines: [], total: 0 })
}

function detectDataSource(
  catalogSource: 'backend' | 'mock',
  backendUnreachable?: boolean,
): ChatContext['dataSource'] {
  if (apiConfig.useMock) return 'mock'
  if (catalogSource === 'backend') return 'api'
  const token = localStorage.getItem('sedsp_access_token')
  if (token?.startsWith('mock.') || backendUnreachable) return 'hybrid'
  return 'mock'
}

/** Thu thập dữ liệu từ backend + mock — gọi song song theo role */
export async function buildChatContext(
  role: UserRole,
  opts?: { userName?: string; userId?: string; sellerBackendId?: string },
): Promise<ChatContext> {
  const sellerKey = opts?.sellerBackendId ?? opts?.userId

  const [catalog, rawCategories, cartData] = await Promise.all([
    loadProducts(),
    safe(() => categoryApi.list(), [] as Category[]),
    loadCart(opts?.userId),
  ])

  const ctx: ChatContext = {
    role,
    userName: opts?.userName,
    userId: opts?.userId,
    products: catalog.products,
    orders: [],
    cartLines: cartData.lines,
    cartTotal: cartData.total,
    cartItemCount: cartData.lines.reduce((s, l) => s + l.quantity, 0),
    categories: countProductsByCategory(catalog.products, rawCategories),
    sellerProducts: [],
    sellerInsights: [],
    managerInsights: [],
    categoryChart: [],
    users: [],
    systemMetrics: [],
    recommendations: [],
    dataSource: detectDataSource(catalog.catalogSource, catalog.backendUnreachable),
    backendOnline: catalog.catalogSource === 'backend' && !catalog.backendUnreachable,
    catalogSource: catalog.catalogSource,
  }

  const roleTasks: Promise<void>[] = []

  if (role === 'customer' && opts?.userId) {
    roleTasks.push(
      (async () => {
        ctx.orders = await safe(() => orderApi.listForCustomer(opts.userId!), [])
        ctx.recommendations = await safe(() => dssApi.recommendations(opts.userId!), [])
      })(),
    )
  }

  if (role === 'guest') {
    /* catalog + categories đã load */
  }

  if (role === 'seller') {
    roleTasks.push(
      (async () => {
        const sellerCatalog = await loadProducts(sellerKey)
        ctx.sellerProducts = sellerCatalog.products
        ctx.orders = await safe(() => orderApi.listForSeller(), [])
        if (apiConfig.useRealSeller) {
          ctx.salesPerformance = await safe(() => sellerApi.getSalesPerformance(), null)
          ctx.sellerDashboard = await safe(() => sellerApi.getDashboard(), null)
        }
        ctx.sellerInsights = await safe(
          () => dssApi.sellerInsights(sellerKey),
          [],
        )
      })(),
    )
  }

  if (role === 'manager') {
    roleTasks.push(
      (async () => {
        ctx.orders = await safe(() => orderApi.listAll(), [])
        ctx.managerInsights = await safe(() => dssApi.managerInsights(), [])
        ctx.categoryChart = await safe(() => dssApi.categoryChart(), [])
      })(),
    )
  }

  if (role === 'admin') {
    roleTasks.push(
      (async () => {
        ctx.users = await safe(() => adminApi.listUsers(), [])
        ctx.systemMetrics = await safe(() => adminApi.systemMetrics(), [])
      })(),
    )
  }

  await Promise.all(roleTasks)
  return ctx
}
