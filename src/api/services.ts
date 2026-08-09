import {
  seedOrders,
  seedPasswords,
  seedProducts,
  seedUsers,
  DEMO_EMAIL_TO_MOCK_ID,
  DEMO_PASSWORD_BACKEND,
} from '@/api/mockData'
import { apiConfig } from '@/api/config'
import { ApiError } from '@/api/http/client'
import * as realAuth from '@/api/real/auth'
import * as realProducts from '@/api/real/products'
import * as realCart from '@/api/real/cart'
import * as realOrders from '@/api/real/orders'
import * as realPayments from '@/api/real/payments'
import * as realCategories from '@/api/real/categories'
import * as realInventory from '@/api/real/inventory'
import * as realUsers from '@/api/real/users'
import * as realSeller from '@/api/real/seller'
import * as realReviews from '@/api/real/reviews'
import * as realDss from '@/api/real/dss'
import * as realPlatformRevenue from '@/api/real/platformRevenue'
import * as realProductImages from '@/api/real/productImages'
import { typingDelay } from '@/api/chat/engine'
import { buildChatContext } from '@/api/chat/context'
import { chatModeLabel, resolveChatReply, refreshBeAiStatus } from '@/api/chat/responder'
import { isLlmConfigured } from '@/api/chat/llm'
import { applyAvatarToUser, saveUserAvatar } from '@/utils/avatar'
import { clearUserSnapshot, saveUserSnapshot } from '@/utils/sessionSnapshot'
import { categoryRevenueChart, monthlyRevenueChart } from '@/utils/orderAnalytics'
import { scoreProductRecommendation } from '@/utils/recommendationScore'
import { repairProductImageUrl } from '@/utils/productImage'
import {
  applyOrderOverlay,
  applyOrderOverlays,
  frontendStatusFromRaw,
  overlayOnlyOrders,
  saveOrderOverlay,
  seedPendingOverlay,
} from '@/utils/orderStatusOverlay'
import { applyRoleOverride, setRoleOverride } from '@/utils/roleApplications'
import { STORAGE_KEYS, storageGet, storageSet } from '@/api/storage'
import type {
  CartItem,
  ChartPoint,
  ChatMessage,
  DssInsight,
  Order,
  OrderItem,
  Product,
  ProductReview,
  RatingSummary,
  Recommendation,
  SystemMetric,
  User,
  UserRole,
  SellerOrdersSource,
} from '@/types'

type PasswordMap = Record<string, string>
type CartMap = Record<string, CartItem[]>
type ChatMap = Record<string, ChatMessage[]>

function delay(ms = 80): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

export function formatSoldCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

export function getDiscountPercent(product: Product): number {
  if (!product.originalPrice || product.originalPrice <= product.price) return 0
  return Math.round((1 - product.price / product.originalPrice) * 100)
}

export function enrichProduct(p: Product): Product {
  return {
    shopName: p.shopName ?? 'Cửa hàng SEDSP',
    shopLocation: p.shopLocation ?? 'Việt Nam',
    reviewCount: p.reviewCount ?? (p.soldCount > 0 ? Math.max(1, Math.floor(p.soldCount * 0.4)) : 0),
    isFlashSale: p.isFlashSale ?? false,
    ...p,
  }
}

const MOCK_DATA_VERSION = 2

function ensureInitialized(): void {
  const version = storageGet<number>('data_version', 0)
  if (storageGet(STORAGE_KEYS.initialized, false) && version >= MOCK_DATA_VERSION) return
  storageSet(STORAGE_KEYS.users, seedUsers)
  storageSet(STORAGE_KEYS.products, seedProducts)
  storageSet(STORAGE_KEYS.orders, seedOrders)
  storageSet('passwords', seedPasswords)
  storageSet('data_version', MOCK_DATA_VERSION)
  storageSet(STORAGE_KEYS.carts, {} as CartMap)
  storageSet(STORAGE_KEYS.chatHistory, {} as ChatMap)
  storageSet(STORAGE_KEYS.initialized, true)
}

function getUsers(): User[] {
  ensureInitialized()
  return storageGet(STORAGE_KEYS.users, seedUsers)
}

function saveUsers(users: User[]): void {
  storageSet(STORAGE_KEYS.users, users)
}

function getPasswords(): PasswordMap {
  ensureInitialized()
  return storageGet('passwords', seedPasswords)
}

function getProducts(): Product[] {
  ensureInitialized()
  return storageGet(STORAGE_KEYS.products, seedProducts)
}

function saveProducts(products: Product[]): void {
  storageSet(STORAGE_KEYS.products, products)
}

function getOrders(): Order[] {
  ensureInitialized()
  return storageGet(STORAGE_KEYS.orders, seedOrders)
}

function saveOrders(orders: Order[]): void {
  storageSet(STORAGE_KEYS.orders, orders)
}

function getCarts(): CartMap {
  ensureInitialized()
  return storageGet(STORAGE_KEYS.carts, {})
}

function saveCarts(carts: CartMap): void {
  storageSet(STORAGE_KEYS.carts, carts)
}

function getChatMap(): ChatMap {
  ensureInitialized()
  return storageGet(STORAGE_KEYS.chatHistory, {})
}

function saveChatMap(map: ChatMap): void {
  storageSet(STORAGE_KEYS.chatHistory, map)
}

function publicUser(u: User): User {
  return applyAvatarToUser({ ...u })
}

// ——— Auth ———
const mockAuthApi = {
  async login(email: string, password: string): Promise<User> {
    await delay()
    const passwords = getPasswords()
    const user = getUsers().find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    )
    if (!user || passwords[user.email] !== password) {
      throw new Error('Email hoặc mật khẩu không đúng')
    }
    if (!user.active) throw new Error('Tài khoản đã bị khóa')
    storageSet(STORAGE_KEYS.session, user.id)
    localStorage.setItem(
      'sedsp_access_token',
      `mock.${btoa(JSON.stringify({ sub: user.id, role: user.role.toUpperCase() }))}`,
    )
    const pub = publicUser(user)
    saveUserSnapshot(pub)
    return pub
  },

  async register(data: {
    email: string
    password: string
    fullName: string
    phone?: string
  }): Promise<User> {
    await delay()
    const users = getUsers()
    if (users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('Email đã được sử dụng')
    }
    const user: User = {
      id: `u-${Date.now()}`,
      email: data.email,
      fullName: data.fullName,
      role: 'customer',
      phone: data.phone,
      createdAt: new Date().toISOString(),
      active: true,
    }
    users.push(user)
    saveUsers(users)
    const passwords = getPasswords()
    passwords[user.email] = data.password
    storageSet('passwords', passwords)
    storageSet(STORAGE_KEYS.session, user.id)
    return publicUser(user)
  },

  async logout(): Promise<void> {
    await delay(30)
    storageSet(STORAGE_KEYS.session, null)
    localStorage.removeItem('sedsp_access_token')
    clearUserSnapshot()
  },

  async getCurrentUser(): Promise<User | null> {
    await delay(30)
    const id = storageGet<string | null>(STORAGE_KEYS.session, null)
    if (!id) return null
    return getUsers().find((u) => u.id === id) ?? null
  },

  async updateProfile(
    userId: string,
    patch: Partial<Pick<User, 'fullName' | 'phone' | 'address' | 'avatarPreset' | 'avatarUrl'>>,
  ): Promise<User> {
    await delay()
    const users = getUsers()
    const idx = users.findIndex((u) => u.id === userId)
    if (idx < 0) throw new Error('Không tìm thấy người dùng')
    if (patch.avatarPreset !== undefined || patch.avatarUrl !== undefined) {
      saveUserAvatar(userId, {
        avatarPreset: patch.avatarPreset ?? users[idx].avatarPreset,
        avatarUrl: patch.avatarUrl ?? users[idx].avatarUrl,
      })
    }
    users[idx] = { ...users[idx], ...patch }
    saveUsers(users)
    return publicUser(users[idx])
  },
}

export const authApi = apiConfig.useRealAuth
  ? {
      login: async (email: string, password: string) => {
        try {
          const user = await realAuth.login(email, password)
          return applyRoleOverride(user)
        } catch (e) {
          if (isBackendUnreachableError(e)) {
            return applyRoleOverride(await mockLoginAcceptingDemoPassword(email, password))
          }
          throw e
        }
      },
      register: async (data: {
        email: string
        password: string
        fullName: string
        phone?: string
      }) => {
        // Never fall back to mock register — that skips OTP and "auto-logs in" on Vercel
        // when Railway times out. Local mock mode uses the branch below (useRealAuth=false).
        return await realAuth.register(data)
      },
      logout: realAuth.logout,
      getCurrentUser: async () => {
        if (isMockSession()) {
          const u = await mockAuthApi.getCurrentUser()
          return u ? applyRoleOverride(u) : null
        }
        try {
          const u = await realAuth.getCurrentUser()
          return u ? applyRoleOverride(u) : null
        } catch (e) {
          // Transient /me failure: realAuth may throw; keep JWT session via snapshot inside realAuth.
          // Do NOT fall through to mock guest — that logs the user out on reload.
          if (isBackendUnreachableError(e)) {
            const token = localStorage.getItem('sedsp_access_token')
            if (token && !token.startsWith('mock.')) {
              throw e
            }
            const u = await mockAuthApi.getCurrentUser()
            return u ? applyRoleOverride(u) : null
          }
          throw e
        }
      },
      updateProfile: async (
        userId: string,
        patch: Partial<Pick<User, 'fullName' | 'phone' | 'address' | 'avatarPreset' | 'avatarUrl'>>,
      ) => {
        if (isMockSession()) {
          return applyRoleOverride(await mockAuthApi.updateProfile(userId, patch))
        }
        const hasProfileFields =
          patch.fullName !== undefined ||
          patch.phone !== undefined ||
          patch.address !== undefined
        const avatarOnly =
          !hasProfileFields &&
          (patch.avatarPreset !== undefined || patch.avatarUrl !== undefined)

        if (avatarOnly) {
          const me = await realAuth.getCurrentUser()
          if (!me) throw new Error('Phiên đăng nhập hết hạn')
          saveUserAvatar(userId, {
            avatarPreset: patch.avatarPreset ?? me.avatarPreset,
            avatarUrl: patch.avatarUrl ?? me.avatarUrl,
          })
          return applyRoleOverride(
            applyAvatarToUser({
              ...me,
              avatarPreset: patch.avatarPreset ?? me.avatarPreset,
              avatarUrl: patch.avatarUrl ?? me.avatarUrl,
            }),
          )
        }

        try {
          const updated = await realAuth.updateProfile(userId, patch)
          if (patch.avatarPreset !== undefined || patch.avatarUrl !== undefined) {
            saveUserAvatar(userId, {
              avatarPreset: patch.avatarPreset ?? updated.avatarPreset,
              avatarUrl: patch.avatarUrl ?? updated.avatarUrl,
            })
            return applyRoleOverride(
              applyAvatarToUser({
                ...updated,
                avatarPreset: patch.avatarPreset ?? updated.avatarPreset,
                avatarUrl: patch.avatarUrl ?? updated.avatarUrl,
              }),
            )
          }
          return applyRoleOverride(updated)
        } catch (e) {
          if (isBackendUnreachableError(e)) {
            return applyRoleOverride(await mockAuthApi.updateProfile(userId, patch))
          }
          throw e
        }
      },
      resendOtp: realAuth.resendOtp,
      verifyEmail: realAuth.verifyEmail,
    }
  : {
      ...mockAuthApi,
      login: async (email: string, password: string) =>
        applyRoleOverride(await mockAuthApi.login(email, password)),
      register: async (data: {
        email: string
        password: string
        fullName: string
        phone?: string
      }) => {
        const user = applyRoleOverride(await mockAuthApi.register(data))
        return { status: 'active' as const, user }
      },
      getCurrentUser: async () => {
        const u = await mockAuthApi.getCurrentUser()
        return u ? applyRoleOverride(u) : null
      },
      resendOtp: async (_email: string) => {
        /* mock: no OTP */
      },
      verifyEmail: async (_email: string, _otp: string) => {
        /* mock: already active */
      },
    }

const mockProductApi = {
  async list(params?: {
    q?: string
    category?: string
    sellerId?: string
  }): Promise<Product[]> {
    await delay()
    let list = [...getProducts()]
    if (params?.sellerId) {
      list = list.filter((p) => p.sellerId === params.sellerId)
    }
    if (params?.category) {
      list = list.filter(
        (p) => p.category.toLowerCase() === params.category!.toLowerCase(),
      )
    }
    if (params?.q) {
      const q = params.q.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      )
    }
    return list.map(enrichProduct)
  },

  async getById(id: string): Promise<Product | null> {
    await delay()
    const p = getProducts().find((item) => item.id === id)
    return p ? enrichProduct(p) : null
  },

  async create(
    sellerId: string,
    data: Omit<Product, 'id' | 'sellerId' | 'createdAt' | 'soldCount' | 'rating'>,
  ): Promise<Product> {
    await delay()
    const product: Product = {
      ...data,
      id: `p-${Date.now()}`,
      sellerId,
      rating: 0,
      soldCount: 0,
      createdAt: new Date().toISOString(),
    }
    const products = getProducts()
    products.push(product)
    saveProducts(products)
    return product
  },

  async update(id: string, patch: Partial<Product>): Promise<Product> {
    await delay()
    const products = getProducts()
    const idx = products.findIndex((p) => p.id === id)
    if (idx < 0) throw new Error('Sản phẩm không tồn tại')
    products[idx] = { ...products[idx], ...patch, id }
    saveProducts(products)
    return products[idx]
  },

  async remove(id: string): Promise<void> {
    await delay()
    saveProducts(getProducts().filter((p) => p.id !== id))
  },

  async categories(): Promise<string[]> {
    await delay(30)
    return [...new Set(getProducts().map((p) => p.category))].sort()
  },
}

function hasBackendToken(): boolean {
  const token = localStorage.getItem('sedsp_access_token')
  return Boolean(token && !token.startsWith('mock.'))
}

function isBackendUnreachableError(e: unknown): boolean {
  if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) return true
  if (e instanceof TypeError) return true
  return false
}

function isMockSession(): boolean {
  const token = localStorage.getItem('sedsp_access_token')
  return Boolean(token?.startsWith('mock.'))
}

async function mockLoginAcceptingDemoPassword(
  email: string,
  password: string,
): Promise<User> {
  await delay()
  const passwords = getPasswords()
  const user = getUsers().find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  )
  if (!user) throw new Error('Email hoặc mật khẩu không đúng')
  const isDemo = Boolean(DEMO_EMAIL_TO_MOCK_ID[user.email.toLowerCase()])
  const passwordOk =
    passwords[user.email] === password ||
    (isDemo && password === DEMO_PASSWORD_BACKEND)
  if (!passwordOk) throw new Error('Email hoặc mật khẩu không đúng')
  if (!user.active) throw new Error('Tài khoản đã bị khóa')
  storageSet(STORAGE_KEYS.session, user.id)
  localStorage.setItem(
    'sedsp_access_token',
    `mock.${btoa(JSON.stringify({ sub: user.id, role: user.role.toUpperCase() }))}`,
  )
  return publicUser(user)
}

export type CatalogSource = 'backend' | 'mock'

const CATALOG_CACHE_MS = 90_000
const catalogListCache = new Map<string, { at: number; products: Product[] }>()
const categoryNamesCache = { at: 0, names: [] as string[] }
const CATEGORY_CACHE_MS = 120_000

/** Clear product list cache after create/update/delete so seller UI refreshes immediately. */
export function invalidateProductCatalogCache() {
  catalogListCache.clear()
}

export interface ProductListResult {
  products: Product[]
  catalogSource: CatalogSource
  /** Backend không phản hồi — đã fallback mock */
  backendUnreachable?: boolean
  totalElements?: number
  totalPages?: number
  page?: number
  size?: number
}

async function listProductsHybridInternal(
  params?: {
    q?: string
    category?: string
    sellerId?: string
    withStock?: boolean
    size?: number
    page?: number
  },
): Promise<ProductListResult> {
  if (!apiConfig.useRealProducts) {
    return {
      products: await mockProductApi.list(params),
      catalogSource: 'mock',
    }
  }
  try {
    const sellerNum =
      params?.sellerId && /^\d+$/.test(params.sellerId)
        ? Number(params.sellerId)
        : undefined

    let categoryId: number | undefined
    if (params?.category && apiConfig.useRealCategories) {
      const cats = await realCategories.listCategories()
      categoryId = realCategories.resolveCategoryId(cats, params.category)
    }

    const pageResult = await realProducts.listProductsPage({
      q: params?.q,
      sellerId: sellerNum,
      categoryId,
      size: params?.size ?? 12,
      page: params?.page ?? 0,
    })
    let list = pageResult.products

    if (params?.category && !categoryId) {
      list = list.filter(
        (p) => p.category.toLowerCase() === params.category!.toLowerCase(),
      )
    }
    if (params?.sellerId && !sellerNum) {
      list = list.filter((p) => p.sellerId === params.sellerId)
    }

    let enriched = list.map(enrichProduct)
    // Stock is included in product list API (availableQuantity). Only refresh when explicitly requested.
    if (apiConfig.useRealInventory && params?.withStock === true && hasBackendToken()) {
      enriched = await realInventory.attachStockToProducts(enriched)
    }
    return {
      products: enriched,
      catalogSource: 'backend',
      totalElements: pageResult.totalElements,
      totalPages: pageResult.totalPages,
      page: pageResult.page,
      size: pageResult.size,
    }
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      throw e
    }
    return {
      products: await mockProductApi.list(params),
      catalogSource: 'mock',
      backendUnreachable: isBackendUnreachableError(e),
    }
  }
}

async function listProductsHybrid(params?: {
  q?: string
  category?: string
  sellerId?: string
  withStock?: boolean
  size?: number
  page?: number
}): Promise<Product[]> {
  const cacheKey = JSON.stringify(params ?? {})
  const hit = catalogListCache.get(cacheKey)
  if (hit && Date.now() - hit.at < CATALOG_CACHE_MS) {
    return hit.products
  }
  const { products } = await listProductsHybridInternal(params)
  catalogListCache.set(cacheKey, { at: Date.now(), products })
  return products
}

export const productApi = {
  list: listProductsHybrid,
  listWithMeta: listProductsHybridInternal,

  async getById(id: string, opts?: { withStock?: boolean }): Promise<Product | null> {
    if (apiConfig.useRealProducts) {
      try {
        let p = await realProducts.getProductById(id)
        if (!p) return null
        p = enrichProduct(p)
        // Detail API now includes availableQuantity; only force-refresh when asked
        if (
          apiConfig.useRealInventory &&
          opts?.withStock === true &&
          hasBackendToken()
        ) {
          const [withStock] = await realInventory.attachStockToProducts([p])
          return withStock
        }
        return p
      } catch {
        // Không fallback mock — tránh hiện SP localStorage (vd. AirFlex) thay vì DB
        return null
      }
    }
    return mockProductApi.getById(id)
  },

  async create(
    _sellerId: string,
    data: Omit<Product, 'id' | 'sellerId' | 'createdAt' | 'soldCount' | 'rating'> & {
      categoryId?: number
      imagePublicId?: string
      images?: { imageUrl: string; publicId?: string; isPrimary?: boolean }[]
    },
  ): Promise<Product> {
    if (apiConfig.useRealProducts && hasBackendToken()) {
      let categoryId = data.categoryId
      if (!categoryId && data.category) {
        const cats = await realCategories.listCategories()
        categoryId = realCategories.resolveCategoryId(cats, data.category)
      }
      const created = await realProducts.createProduct({
        name: data.name,
        description: data.description,
        price: data.price,
        categoryId,
        imageUrl: data.imageUrl,
        imagePublicId: data.imagePublicId,
        images: data.images,
      })
      invalidateProductCatalogCache()
      if (data.stock > 0 && apiConfig.useRealInventory) {
        await realInventory.adjustInventory(created.id, data.stock, 'MANUAL_ADJUST')
      }
      const [withStock] = await realInventory.attachStockToProducts([
        enrichProduct({ ...created, stock: data.stock }),
      ])
      return withStock
    }
    if (apiConfig.useRealProducts) {
      throw new Error('Cần đăng nhập seller thật (JWT) để lưu sản phẩm vào database')
    }
    return mockProductApi.create(_sellerId, data)
  },

  async update(
    id: string,
    patch: Partial<Product> & {
      categoryId?: number
      stockDelta?: number
      imagePublicId?: string
      images?: { imageUrl: string; publicId?: string; isPrimary?: boolean }[]
    },
  ): Promise<Product> {
    if (apiConfig.useRealProducts && hasBackendToken()) {
      let categoryId = patch.categoryId
      if (!categoryId && patch.category) {
        const cats = await realCategories.listCategories()
        categoryId = realCategories.resolveCategoryId(cats, patch.category)
      }
      const updated = await realProducts.updateProduct(id, {
        name: patch.name,
        description: patch.description,
        price: patch.price,
        categoryId,
        imageUrl: patch.imageUrl,
        imagePublicId: patch.imagePublicId,
        images: patch.images,
      })
      invalidateProductCatalogCache()
      if (patch.stock != null && apiConfig.useRealInventory) {
        const inv = await realInventory.getInventory(id)
        const delta = patch.stock - inv.availableQuantity
        if (delta !== 0) {
          await realInventory.adjustInventory(id, delta, 'MANUAL_ADJUST')
        }
      } else if (patch.stockDelta != null && patch.stockDelta !== 0 && apiConfig.useRealInventory) {
        await realInventory.adjustInventory(id, patch.stockDelta, 'MANUAL_ADJUST')
      }
      const [withStock] = await realInventory.attachStockToProducts([enrichProduct(updated)])
      return withStock
    }
    return mockProductApi.update(id, patch)
  },

  async remove(id: string): Promise<void> {
    if (apiConfig.useRealProducts && hasBackendToken()) {
      await realProducts.deleteProduct(id)
      invalidateProductCatalogCache()
      return
    }
    await mockProductApi.remove(id)
    invalidateProductCatalogCache()
  },

  async categories(): Promise<string[]> {
    if (
      categoryNamesCache.names.length &&
      Date.now() - categoryNamesCache.at < CATEGORY_CACHE_MS
    ) {
      return categoryNamesCache.names
    }
    if (apiConfig.useRealCategories) {
      try {
        const names = await realCategories.categoryNames()
        categoryNamesCache.names = names
        categoryNamesCache.at = Date.now()
        return names
      } catch {
        /* fallback */
      }
    }
    const names = await mockProductApi.categories()
    categoryNamesCache.names = names
    categoryNamesCache.at = Date.now()
    return names
  },

  async uploadImage(file: File): Promise<{ url: string; publicId: string }> {
    if (apiConfig.useRealProducts && hasBackendToken()) {
      return realProductImages.uploadProductImage(file)
    }
    throw new Error('Upload ảnh cần đăng nhập seller/admin và backend đang chạy')
  },
}

export const categoryApi = {
  async list(force = false): Promise<realCategories.Category[]> {
    if (apiConfig.useRealCategories) {
      return realCategories.listCategories(force)
    }
    const names = await mockProductApi.categories()
    return names.map((name, i) => ({
      id: String(i + 1),
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
    }))
  },

  async create(name: string): Promise<realCategories.Category> {
    if (apiConfig.useRealCategories && hasBackendToken()) {
      return realCategories.createCategory(name)
    }
    throw new Error('Cần đăng nhập seller/admin và backend để tạo danh mục')
  },
}

export const inventoryApi = {
  get: realInventory.getInventory,
  adjust: realInventory.adjustInventory,
}

// ——— Cart ———
const mockCartApi = {
  async getCart(userId: string): Promise<CartItem[]> {
    await delay(30)
    return getCarts()[userId] ?? []
  },

  async setCart(userId: string, items: CartItem[]): Promise<CartItem[]> {
    await delay(30)
    const carts = getCarts()
    carts[userId] = items
    saveCarts(carts)
    return items
  },

  async addItem(userId: string, productId: string, qty = 1): Promise<CartItem[]> {
    await delay()
    const product = getProducts().find((p) => p.id === productId)
    if (!product) throw new Error('Sản phẩm không tồn tại')
    if (product.stock < qty) throw new Error('Không đủ tồn kho')
    const carts = getCarts()
    const items = [...(carts[userId] ?? [])]
    const existing = items.find((i) => i.productId === productId)
    if (existing) {
      existing.quantity += qty
      if (existing.quantity > product.stock) {
        throw new Error('Không đủ tồn kho')
      }
    } else {
      items.push({ productId, quantity: qty })
    }
    carts[userId] = items
    saveCarts(carts)
    return items
  },

  async updateQuantity(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartItem[]> {
    await delay()
    if (quantity <= 0) return mockCartApi.removeItem(userId, productId)
    const product = getProducts().find((p) => p.id === productId)
    if (!product || product.stock < quantity) {
      throw new Error('Không đủ tồn kho')
    }
    const carts = getCarts()
    const items = (carts[userId] ?? []).map((i) =>
      i.productId === productId ? { ...i, quantity } : i,
    )
    carts[userId] = items
    saveCarts(carts)
    return items
  },

  async removeItem(userId: string, productId: string): Promise<CartItem[]> {
    await delay(30)
    const carts = getCarts()
    carts[userId] = (carts[userId] ?? []).filter((i) => i.productId !== productId)
    saveCarts(carts)
    return carts[userId]
  },

  async clear(userId: string): Promise<void> {
    await delay(30)
    const carts = getCarts()
    delete carts[userId]
    saveCarts(carts)
  },
}

async function findRealCartItemId(productId: string): Promise<string | null> {
  const cart = await realCart.getCart()
  const item = cart.items.find((i) => String(i.productId) === productId)
  if (!item) return null
  if (item.id == null) {
    throw new Error('Giỏ hàng thiếu mã item — hãy tải lại trang')
  }
  return String(item.id)
}

export const cartApi = {
  async getCart(userId: string): Promise<CartItem[]> {
    if (apiConfig.useRealCart && hasBackendToken()) {
      const cart = await realCart.getCart()
      return cart.items.map((i) => ({
        productId: String(i.productId),
        quantity: i.quantity,
        cartItemId: i.id != null ? String(i.id) : undefined,
      }))
    }
    return mockCartApi.getCart(userId)
  },

  async addItem(userId: string, productId: string, qty = 1): Promise<CartItem[]> {
    if (apiConfig.useRealCart && hasBackendToken()) {
      await realCart.addCartItem(productId, qty)
      return cartApi.getCart(userId)
    }
    return mockCartApi.addItem(userId, productId, qty)
  },

  async updateQuantity(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartItem[]> {
    if (apiConfig.useRealCart && hasBackendToken()) {
      if (quantity <= 0) return cartApi.removeItem(userId, productId)
      const itemId = await findRealCartItemId(productId)
      if (!itemId) throw new Error('Sản phẩm không có trong giỏ')
      await realCart.updateCartItem(itemId, quantity)
      return cartApi.getCart(userId)
    }
    return mockCartApi.updateQuantity(userId, productId, quantity)
  },

  async removeItem(userId: string, productId: string): Promise<CartItem[]> {
    if (apiConfig.useRealCart && hasBackendToken()) {
      const itemId = await findRealCartItemId(productId)
      if (itemId) await realCart.removeCartItem(itemId)
      return cartApi.getCart(userId)
    }
    return mockCartApi.removeItem(userId, productId)
  },

  async clear(userId: string): Promise<void> {
    if (apiConfig.useRealCart && hasBackendToken()) {
      await realCart.clearCart()
      return
    }
    return mockCartApi.clear(userId)
  },
}

export interface CartLine {
  product: Product
  quantity: number
  subtotal: number
  cartItemId?: string
}

export async function resolveCartLines(userId: string): Promise<CartLine[]> {
  const items = await cartApi.getCart(userId)

  if (apiConfig.useRealCart && hasBackendToken()) {
    const cart = await realCart.getCart()
    // Prefer catalog images (same mapper as shop) so cart/checkout match listing
    const byId = new Map<string, Product>()
    try {
      const catalog = await listProductsHybrid({ size: 120 })
      for (const p of catalog) byId.set(p.id, p)
    } catch {
      /* fall back to cart API image */
    }

    return cart.items.map((item) => {
      const price = realCart.cartNum(item.price)
      const subtotal = realCart.cartNum(item.totalPrice, price * item.quantity)
      const pid = String(item.productId)
      const fromCatalog = byId.get(pid)
      const imageUrl =
        fromCatalog?.imageUrl ||
        repairProductImageUrl(item.productImageUrl, { seed: pid, category: fromCatalog?.category })
      return {
        cartItemId: String(item.id),
        product: {
          id: pid,
          name: item.productName || fromCatalog?.name || 'Sản phẩm',
          description: fromCatalog?.description ?? '',
          price,
          stock: fromCatalog?.stock ?? 0,
          category: fromCatalog?.category ?? '',
          imageUrl,
          imageUrls: fromCatalog?.imageUrls?.length ? fromCatalog.imageUrls : [imageUrl],
          sellerId: fromCatalog?.sellerId ?? '',
          shopName: fromCatalog?.shopName ?? 'SEDSP Official',
          shopLocation: fromCatalog?.shopLocation ?? 'TP.HCM',
          rating: fromCatalog?.rating ?? 4.5,
          soldCount: fromCatalog?.soldCount ?? 0,
          createdAt: fromCatalog?.createdAt ?? new Date().toISOString(),
        },
        quantity: item.quantity,
        subtotal,
      }
    })
  }

  const products = getProducts()
  const lines: CartLine[] = []
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)
    if (!product) continue
    lines.push({
      product,
      quantity: item.quantity,
      subtotal: product.price * item.quantity,
      cartItemId: item.cartItemId,
    })
  }
  return lines
}

// ——— Orders ———
const mockOrderApi = {
  async listForCustomer(customerId: string): Promise<Order[]> {
    await delay()
    return getOrders()
      .filter((o) => o.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async listAll(): Promise<Order[]> {
    await delay()
    return getOrders().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async getById(id: string): Promise<Order | null> {
    await delay()
    return getOrders().find((o) => o.id === id) ?? null
  },

  async placeOrder(
    customerId: string,
    shippingAddress: string,
    _payment?: 'momo' | 'vnpay' | 'cod' | 'bank' | 'card',
  ): Promise<Order> {
    await delay()
    const user = getUsers().find((u) => u.id === customerId)
    if (!user) throw new Error('Người dùng không tồn tại')
    const lines = await resolveCartLines(customerId)
    if (lines.length === 0) throw new Error('Giỏ hàng trống')

    const products = getProducts()
    const orderItems: OrderItem[] = lines.map((l) => ({
      productId: l.product.id,
      productName: l.product.name,
      quantity: l.quantity,
      unitPrice: l.product.price,
    }))
    const total = lines.reduce((s, l) => s + l.subtotal, 0)

    for (const line of lines) {
      const p = products.find((x) => x.id === line.product.id)
      if (!p || p.stock < line.quantity) {
        throw new Error(`Không đủ tồn kho: ${line.product.name}`)
      }
      p.stock -= line.quantity
      p.soldCount += line.quantity
    }
    saveProducts(products)

    const order: Order = {
      id: `o-${Date.now()}`,
      customerId,
      customerName: user.fullName,
      items: orderItems,
      total,
      status: 'pending',
      shippingAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const orders = getOrders()
    orders.push(order)
    saveOrders(orders)
    await cartApi.clear(customerId)
    return order
  },

  async updateStatus(id: string, status: Order['status']): Promise<Order> {
    await delay()
    const orders = getOrders()
    const idx = orders.findIndex((o) => o.id === id)
    if (idx < 0) throw new Error('Đơn hàng không tồn tại')
    orders[idx] = {
      ...orders[idx],
      status,
      updatedAt: new Date().toISOString(),
    }
    saveOrders(orders)
    return orders[idx]
  },
}

async function mergedAllOrders(): Promise<Order[]> {
  let orders: Order[] = []
  if (apiConfig.useRealOrders) {
    if (!hasBackendToken()) return []
    orders = await realOrders.listManagedOrders(0, 100)
    return applyOrderOverlays(orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  orders = await mockOrderApi.listAll()
  const merged = applyOrderOverlays(orders)
  const ids = new Set(merged.map((o) => o.id))
  return [...merged, ...overlayOnlyOrders(ids)].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

export const orderApi = {
  async listForCustomer(customerId: string): Promise<Order[]> {
    let orders: Order[]
    if (apiConfig.useRealOrders) {
      if (!hasBackendToken()) return []
      // Chỉ đơn từ DB — không trộn seedOrders / localStorage mock
      orders = await realOrders.listMyOrders(0, 50)
    } else {
      orders = await mockOrderApi.listForCustomer(customerId)
    }
    return applyOrderOverlays(orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async listForSeller(): Promise<Order[]> {
    const { orders } = await this.listForSellerWithMeta()
    return orders
  },

  async listForSellerWithMeta(): Promise<{ orders: Order[]; source: SellerOrdersSource }> {
    let orders: Order[] = []
    let source: SellerOrdersSource = 'mock'

    if (apiConfig.useRealOrders && hasBackendToken()) {
      let apiError: unknown
      try {
        orders = await realOrders.listSellerOrders(0, 20)
        source = 'api'
      } catch (e) {
        apiError = e
        try {
          const dash = await realSeller.getDashboard()
          if (dash.recentOrders.length) {
            orders = realSeller.ordersFromDashboardRecent(dash.recentOrders)
            source = 'dashboard'
          }
        } catch {
          /* keep apiError */
        }
      }
      // Real mode: never silently treat API failure as “no orders”
      if (!orders.length && apiError) {
        throw apiError instanceof Error
          ? apiError
          : new Error('Không tải được đơn hàng seller')
      }
    }

    if (!orders.length && !apiConfig.useRealOrders) {
      const sellerId = getUsers().find((u) => u.role === 'seller')?.id ?? 'u-seller'
      const productIds = new Set(
        getProducts().filter((p) => p.sellerId === sellerId).map((p) => p.id),
      )
      orders = getOrders()
        .filter((o) => o.items.some((i) => productIds.has(i.productId)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      source = 'mock'
    }

    const merged = applyOrderOverlays(orders)
    if (apiConfig.useRealOrders) {
      return {
        orders: merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        source,
      }
    }
    const ids = new Set(merged.map((o) => o.id))
    const extra = overlayOnlyOrders(ids)
    return {
      orders: [...merged, ...extra].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      source,
    }
  },

  async listAll(): Promise<Order[]> {
    return mergedAllOrders()
  },

  async getById(id: string): Promise<Order | null> {
    let order: Order | null = null
    if (apiConfig.useRealOrders) {
      if (!hasBackendToken()) return null
      order = await realOrders.getOrderById(id)
      if (!order) return null
      return applyOrderOverlay(order)
    }
    order = await mockOrderApi.getById(id)
    if (!order) {
      const only = overlayOnlyOrders(new Set()).find((o) => o.id === id)
      return only ?? null
    }
    return applyOrderOverlay(order)
  },

  async placeOrder(
    customerId: string,
    shippingAddress: string,
    payment: 'momo' | 'vnpay' | 'cod' | 'bank' | 'card' = 'cod',
  ): Promise<Order> {
    let order: Order
    if (apiConfig.useRealOrders && hasBackendToken()) {
      order = await realOrders.createOrder(
        shippingAddress,
        realOrders.toBackendPayment(payment),
      )
      // Backend tạo PENDING — đảm bảo FE và seller cùng thấy chờ xác nhận
      order = {
        ...order,
        status: order.status || 'pending',
        rawStatus: order.rawStatus || 'PENDING',
        shippingAddress: order.shippingAddress || shippingAddress,
        paymentMethod:
          payment === 'cod'
            ? 'cod'
            : payment === 'momo' || payment === 'card'
              ? 'momo'
              : 'vnpay',
      }
    } else {
      order = await mockOrderApi.placeOrder(customerId, shippingAddress, payment)
    }
    seedPendingOverlay(order)
    return applyOrderOverlay(order)
  },

  /** Gọi gateway VNPay (MoMo giữ tương thích cũ, UI đã bỏ) */
  async initiatePayment(
    orderId: string,
    method: 'momo' | 'vnpay' = 'vnpay',
  ): Promise<realPayments.PaymentInfo> {
    if (apiConfig.useRealOrders && hasBackendToken()) {
      return realPayments.payOrder(orderId, method === 'momo' ? 'MOMO' : 'VNPAY')
    }
    return {
      id: `mock-pay-${orderId}`,
      orderId,
      paymentMethod: method === 'momo' ? 'MOMO' : 'VNPAY',
      amount: 0,
      status: 'PENDING',
      redirectUrl: `/payment/result?gateway=${method === 'momo' ? 'momo' : 'vnpay'}&orderId=${orderId}&status=success&mock=1`,
    }
  },

  async getPayment(orderId: string): Promise<realPayments.PaymentInfo | null> {
    if (apiConfig.useRealOrders && hasBackendToken()) {
      return realPayments.getPaymentByOrder(orderId)
    }
    return null
  },

  async updateStatus(id: string, status: Order['status']): Promise<Order> {
    if (apiConfig.useRealOrders && hasBackendToken()) {
      if (status === 'cancelled') {
        await realOrders.cancelOrder(id)
        const order = await realOrders.getOrderById(id)
        if (!order) throw new Error('Đơn hàng không tồn tại')
        saveOrderOverlay({
          orderId: id,
          status: 'cancelled',
          rawStatus: 'CANCELLED',
          note: 'Khách hủy đơn',
          updatedByRole: 'customer',
          customerName: order.customerName,
          total: order.total,
          shippingAddress: order.shippingAddress,
          items: order.items,
          createdAt: order.createdAt,
        })
        return applyOrderOverlay(order)
      }
      throw new Error('Chỉ hỗ trợ hủy đơn qua API backend')
    }
    const updated = await mockOrderApi.updateStatus(id, status)
    const rawMap: Record<Order['status'], realOrders.BackendOrderStatus> = {
      pending: 'PENDING',
      confirmed: 'PROCESSING',
      shipping: 'SHIPPING',
      delivered: 'DELIVERED',
      cancelled: 'CANCELLED',
    }
    saveOrderOverlay({
      orderId: id,
      status,
      rawStatus: rawMap[status],
      customerName: updated.customerName,
      total: updated.total,
      items: updated.items,
      createdAt: updated.createdAt,
    })
    return applyOrderOverlay(updated)
  },

  async updateBackendStatus(
    id: string,
    status: realOrders.BackendOrderStatus,
    note?: string,
  ): Promise<{ order: Order; persistedOnBackend: boolean }> {
    if (apiConfig.useRealOrders && hasBackendToken()) {
      try {
        const order = await realOrders.updateOrderStatus(id, status, note)
        saveOrderOverlay({
          orderId: id,
          status: frontendStatusFromRaw(status),
          rawStatus: status,
          note,
          updatedByRole: 'seller',
          customerName: order.customerName,
          total: order.total,
          shippingAddress: order.shippingAddress,
          items: order.items,
          createdAt: order.createdAt,
        })
        return { order: applyOrderOverlay(order), persistedOnBackend: true }
      } catch {
        /* backend chưa có PUT /orders/{id}/status — lưu overlay dùng chung buyer/seller */
      }
    }

    const feStatus = frontendStatusFromRaw(status)
    let base: Order | null = null
    try {
      base = await this.getById(id)
    } catch {
      base = null
    }
    if (!base) {
      try {
        base = await mockOrderApi.updateStatus(id, feStatus)
      } catch {
        base = {
          id,
          customerId: '',
          customerName: '',
          items: [],
          total: 0,
          status: feStatus,
          rawStatus: status,
          shippingAddress: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      }
    }

    const overlay = saveOrderOverlay({
      orderId: id,
      status: feStatus,
      rawStatus: status,
      note,
      updatedByRole: 'seller',
      customerName: base.customerName,
      total: base.total,
      shippingAddress: base.shippingAddress,
      items: base.items,
      createdAt: base.createdAt,
    })

    try {
      await mockOrderApi.updateStatus(id, feStatus)
    } catch {
      /* id từ backend không có trong mock — overlay là nguồn sự thật */
    }

    return {
      order: applyOrderOverlay({
        ...base,
        status: feStatus,
        rawStatus: status,
        updatedAt: overlay.updatedAt,
      }),
      persistedOnBackend: false,
    }
  },
}

// ——— Seller (dashboard & sales) ———
export const sellerApi = {
  async getSalesPerformance(): Promise<realSeller.SalesPerformance | null> {
    if (apiConfig.useRealSeller && hasBackendToken()) {
      try {
        return await realSeller.getSalesPerformance()
      } catch {
        return null
      }
    }
    return null
  },

  async getDashboard(): Promise<realSeller.SellerDashboard | null> {
    if (apiConfig.useRealSeller && hasBackendToken()) {
      try {
        return await realSeller.getDashboard()
      } catch {
        return null
      }
    }
    return null
  },
}

// ——— Reviews ———
export const reviewApi = {
  async list(productId: string): Promise<ProductReview[]> {
    if (apiConfig.useRealReviews) {
      try {
        return await realReviews.listReviews(productId)
      } catch {
        /* fallback mock below */
      }
    }
    return []
  },

  async summary(productId: string): Promise<RatingSummary | null> {
    if (apiConfig.useRealReviews) {
      try {
        return await realReviews.getRatingSummary(productId)
      } catch {
        return null
      }
    }
    return null
  },

  async create(
    productId: string,
    input: { rating: number; comment: string },
  ): Promise<ProductReview> {
    if (apiConfig.useRealReviews && hasBackendToken()) {
      return realReviews.createReview(productId, input)
    }
    throw new Error('Cần đăng nhập để đánh giá sản phẩm')
  },
}

// ——— DSS & Analytics ———
export const dssApi = {
  async sellerInsights(sellerKey?: string): Promise<DssInsight[]> {
    await delay()

    if (apiConfig.useRealSeller && hasBackendToken()) {
      try {
        const dash = await realSeller.getDashboard()
        const fromApi: DssInsight[] = []

        for (const low of dash.lowStockProducts) {
          fromApi.push({
            id: `api-low-${low.productId}`,
            title: 'Tồn kho thấp',
            description: `${low.productName} — còn ${low.quantity} sản phẩm.`,
            impact: low.quantity < 10 ? 'high' : 'medium',
            category: 'inventory',
          })
        }

        dash.recommendations.forEach((rec, i) => {
          const priority = String(rec.priority ?? 'INFO').toUpperCase()
          // Tránh dump JSON thô lên UI nếu mapRecommendation chưa unwrap kịp
          let title = (rec.title || '').trim()
          let description = (rec.message || '').trim()
          if (description.startsWith('{') && description.includes('"message"')) {
            try {
              const parsed = JSON.parse(description) as {
                title?: string
                message?: string
                priority?: string
                actionUrl?: string
                actionLabel?: string
                id?: string
              }
              title = (parsed.title || title || 'Gợi ý từ dashboard').trim()
              description = (parsed.message || '').trim()
              fromApi.push({
                id: parsed.id || rec.id || `api-rec-${i}`,
                title: title || 'Gợi ý từ dashboard',
                description: description || title || 'Không có nội dung gợi ý.',
                impact:
                  String(parsed.priority ?? priority).toUpperCase() === 'HIGH'
                    ? 'high'
                    : String(parsed.priority ?? priority).toUpperCase() === 'MEDIUM'
                      ? 'medium'
                      : 'low',
                category: 'recommendation',
                actionUrl: parsed.actionUrl || rec.actionUrl,
                actionLabel: parsed.actionLabel || rec.actionLabel,
                priorityLabel: String(parsed.priority ?? priority).toUpperCase(),
              })
              return
            } catch {
              /* fall through */
            }
          }
          fromApi.push({
            id: rec.id || `api-rec-${i}`,
            title: title || 'Gợi ý từ dashboard',
            description: description || 'Không có nội dung gợi ý.',
            impact:
              priority === 'HIGH'
                ? 'high'
                : priority === 'MEDIUM'
                  ? 'medium'
                  : 'low',
            category: 'recommendation',
            actionUrl: rec.actionUrl,
            actionLabel: rec.actionLabel,
            priorityLabel: priority,
          })
        })

        if (dash.ratingWarning) {
          fromApi.push({
            id: 'api-rating',
            title: 'Cảnh báo đánh giá',
            description: dash.ratingWarning,
            impact: 'high',
            category: 'rating',
          })
        }

        if (fromApi.length) return fromApi
      } catch {
        /* fallback hybrid below */
      }
    }

    let products: Product[] = []
    try {
      products = await listProductsHybrid({
        sellerId: sellerKey,
        withStock: false,
      })
    } catch {
      products = []
    }
    if (!products.length) {
      const fallback = sellerKey ?? 'u-seller'
      products = getProducts().filter(
        (p) => p.sellerId === fallback || p.sellerId === 'u-seller',
      )
    }
    const lowStock = products.filter((p) => p.stock < 20)
    const topSeller = [...products].sort((a, b) => b.soldCount - a.soldCount)[0]
    return [
      {
        id: 'd1',
        title: 'Nhập thêm hàng',
        description:
          lowStock.length > 0
            ? `${lowStock.map((p) => p.name).join(', ')} sắp hết hàng (${lowStock.length} SP).`
            : `Tồn kho ổn định — ${products.length} sản phẩm đang bán.`,
        impact: lowStock.length > 0 ? 'high' : 'low',
        category: 'inventory',
      },
      {
        id: 'd2',
        title: 'Điều chỉnh giá cạnh tranh',
        description: topSeller
          ? `${topSeller.name} bán chạy nhất (${topSeller.soldCount} đơn). Cân nhắc combo hoặc flash sale.`
          : 'Thêm sản phẩm để nhận gợi ý giá.',
        impact: topSeller && topSeller.soldCount > 10 ? 'medium' : 'low',
        category: 'pricing',
      },
      {
        id: 'd3',
        title: 'Khuyến mãi chéo',
        description:
          products.length >= 2
            ? `Gợi ý bundle ${products[0]?.category} với phụ kiện liên quan.`
            : 'Mở rộng danh mục để tăng AOV.',
        impact: 'medium',
        category: 'promotion',
      },
    ]
  },

  async managerInsights(): Promise<DssInsight[]> {
    await delay()
    const orders = await mergedAllOrders()
    const revenue = orders.reduce((s, o) => s + o.total, 0)
    const pending = orders.filter((o) => o.status === 'pending').length
    const delivered = orders.filter((o) => o.status === 'delivered').length
    const source = apiConfig.useRealOrders && hasBackendToken() ? 'API backend' : 'dữ liệu demo'
    return [
      {
        id: 'm1',
        title: 'Tăng trưởng doanh thu',
        description: `Doanh thu tích lũy ${formatVnd(revenue)} từ ${orders.length} đơn (${source}).`,
        impact: 'high',
        category: 'revenue',
      },
      {
        id: 'm2',
        title: 'Đơn chờ xử lý',
        description:
          pending > 0
            ? `${pending} đơn đang chờ xác nhận — ưu tiên xử lý để giảm tỷ lệ hủy.`
            : 'Không có đơn chờ — vận hành ổn định.',
        impact: pending > 2 ? 'high' : 'medium',
        category: 'operations',
      },
      {
        id: 'm3',
        title: 'Đơn đã giao',
        description: `${delivered} đơn hoàn tất — khách có thể đánh giá sản phẩm sau giao hàng.`,
        impact: 'medium',
        category: 'fulfillment',
      },
    ]
  },

  async salesChart(sellerKey?: string): Promise<ChartPoint[]> {
    await delay()

    if (apiConfig.useRealSeller && hasBackendToken()) {
      try {
        const perf = await realSeller.getSalesPerformance()
        if (perf.monthlyRevenue.length) return perf.monthlyRevenue
      } catch {
        /* fallback below */
      }
    }

    if (!sellerKey && apiConfig.useRealOrders && hasBackendToken()) {
      try {
        const orders = await realOrders.listManagedOrders(0, 200)
        const chart = monthlyRevenueChart(orders)
        if (chart.length) return chart
      } catch {
        /* fallback below */
      }
    }

    const mockChart: ChartPoint[] = [
      { label: 'T1', value: 12_500_000 },
      { label: 'T2', value: 15_200_000 },
      { label: 'T3', value: 14_800_000 },
      { label: 'T4', value: 18_900_000 },
      { label: 'T5', value: 22_100_000 },
      { label: 'T6', value: 25_300_000 },
    ]

    let products: Product[] = []
    try {
      if (sellerKey) {
        products = await listProductsHybrid({ sellerId: sellerKey, withStock: false })
      }
    } catch {
      products = []
    }
    if (!products.length && sellerKey) {
      products = getProducts().filter(
        (p) => p.sellerId === sellerKey || p.sellerId === 'u-seller',
      )
    }

    if (!products.length) return mockChart

    const estimatedRevenue = products.reduce(
      (s, p) => s + p.soldCount * p.price,
      0,
    )
    if (estimatedRevenue <= 0) return mockChart

    const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
    const weights = [0.12, 0.14, 0.15, 0.16, 0.2, 0.23]
    return months.map((label, i) => ({
      label,
      value: Math.round(estimatedRevenue * weights[i]),
    }))
  },

  async categoryChart(): Promise<ChartPoint[]> {
    await delay()
    if (apiConfig.useRealOrders && hasBackendToken()) {
      try {
        const [orders, products] = await Promise.all([
          realOrders.listManagedOrders(0, 200),
          listProductsHybrid(),
        ])
        const chart = categoryRevenueChart(orders, products)
        if (chart.length) return chart
      } catch {
        /* fallback mock below */
      }
    }
    const map = new Map<string, number>()
    for (const p of getProducts()) {
      map.set(p.category, (map.get(p.category) ?? 0) + p.soldCount * p.price * 0.01)
    }
    return [...map.entries()].map(([label, value]) => ({
      label,
      value: Math.round(value),
    }))
  },

  async recommendations(customerId: string): Promise<Recommendation[]> {
    let orders: Order[] = []
    if (apiConfig.useRealOrders) {
      if (hasBackendToken()) {
        try {
          orders = await realOrders.listMyOrders(0, 50)
        } catch {
          orders = []
        }
      }
    } else {
      orders = getOrders().filter((o) => o.customerId === customerId)
    }

    let catalog: Product[] = []
    try {
      catalog = await listProductsHybrid({ size: 80 })
    } catch {
      catalog = getProducts()
    }
    const byId = new Map(catalog.map((p) => [p.id, p]))

    const bought = new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))
    const boughtCategories = new Map<string, number>()
    const spendSamples: number[] = []
    for (const o of orders) {
      for (const item of o.items) {
        const p =
          byId.get(item.productId) ||
          getProducts().find((x) => x.id === item.productId)
        if (p) {
          boughtCategories.set(p.category, (boughtCategories.get(p.category) ?? 0) + item.quantity)
        } else if (item.productName) {
          // Fallback: infer category from catalog name match
          const hit = catalog.find(
            (c) => c.name.toLowerCase() === item.productName.toLowerCase(),
          )
          if (hit) {
            boughtCategories.set(hit.category, (boughtCategories.get(hit.category) ?? 0) + item.quantity)
          }
        }
        spendSamples.push(item.unitPrice * item.quantity)
      }
    }

    const preferredCategories = [...boughtCategories.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c)
    const avgSpend =
      spendSamples.length > 0
        ? spendSamples.reduce((a, b) => a + b, 0) / spendSamples.length
        : null

    const candidates = catalog.filter((p) => !bought.has(p.id))
    return candidates
      .map((p) =>
        scoreProductRecommendation(p, {
          boughtIds: bought,
          categoryCounts: boughtCategories,
          avgSpend,
          preferredCategories,
        }),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  },

  async forecastDemand(input: {
    productId: string
    historyDays: number
    forecastDays: number
  }) {
    return realDss.forecastDemand(input.productId, input.historyDays, input.forecastDays)
  },

  async createDemandPrediction(input: {
    productId: number
    forecastPeriod: number
    historicalDays: number
  }) {
    return realDss.createDemandPrediction(input)
  },

  async recommendPrice(productId: string, lookbackDays = 30) {
    return realDss.recommendPrice(productId, lookbackDays)
  },

  async createPricePrediction(input: {
    productId: number
    fromDate: string
    toDate: string
  }) {
    return realDss.createPricePrediction(input)
  },

  async analyzeSellerWhatIf(input: {
    productId: number
    discountPercentage: number
    simulationPeriod: number
  }) {
    return realDss.analyzeSellerWhatIf(input)
  },

  async recommendInventory(planningDays: number, productId?: string) {
    return realDss.recommendInventory(planningDays, productId)
  },

  async insightPlan(): Promise<realDss.DssInsightPlanApi> {
    const fallback = (note: string): realDss.DssInsightPlanApi => ({
      source: 'local-fallback',
      commentary: [
        '## Nhận xét & kế hoạch (fallback)',
        note,
        '',
        '## Gợi ý nhanh',
        '1. Mở **Dự báo nhu cầu** / **Gợi ý giá** để chạy DSS trên sản phẩm của bạn.',
        '2. Theo dõi **Doanh số** và đơn bán để bổ sung dữ liệu DELIVERED.',
        '3. Đăng nhập lại nếu phiên JWT hết hạn — rồi tải lại trang DSS.',
      ].join('\n'),
      metrics: {},
      powerBiEmbedUrl: '',
      powerBiReportTitle: 'SEDSP Decision Dashboard',
      powerBiFeedHint: 'GET /api/v1/analytics/powerbi/sales (Bearer JWT)',
      generatedAt: new Date().toISOString(),
    })

    if (!hasBackendToken()) {
      return fallback(
        'Chưa có token backend. Đăng nhập seller thật (JWT) để lấy nhận xét từ API.',
      )
    }

    try {
      return await realDss.insightPlan()
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        return fallback(
          'Phiên đăng nhập hết hạn hoặc thiếu quyền (Authentication failed). Hãy **đăng xuất → đăng nhập lại** rồi mở DSS.',
        )
      }
      const msg = e instanceof Error ? e.message : 'Không tải được kế hoạch từ API'
      return fallback(msg)
    }
  },
}

// ——— Admin ———
const mockAdminApi = {
  async listUsers(): Promise<User[]> {
    await delay()
    return getUsers()
  },

  async setUserActive(userId: string, active: boolean): Promise<User> {
    await delay()
    const users = getUsers()
    const idx = users.findIndex((u) => u.id === userId)
    if (idx < 0) throw new Error('Không tìm thấy người dùng')
    users[idx] = { ...users[idx], active }
    saveUsers(users)
    return users[idx]
  },

  async setUserRole(userId: string, role: UserRole): Promise<User> {
    await delay()
    if (role === 'guest') throw new Error('Không thể gán role guest')
    const users = getUsers()
    const idx = users.findIndex((u) => u.id === userId)
    if (idx < 0) throw new Error('Không tìm thấy người dùng')
    users[idx] = { ...users[idx], role }
    saveUsers(users)
    setRoleOverride(users[idx].email, role)
    return users[idx]
  },

  async systemMetrics(): Promise<SystemMetric[]> {
    await delay()
    const base: SystemMetric[] = [
      { name: 'API Gateway', value: '99.9%', status: 'ok' },
      { name: 'PostgreSQL', value: 'Connected', status: 'ok' },
      { name: 'Redis', value: '12ms latency', status: 'ok' },
      { name: 'n8n Workflows', value: '3 active', status: 'ok' },
      { name: 'Order Queue', value: 2, status: 'warn' },
      { name: 'Error Rate (1h)', value: '0.02%', status: 'ok' },
    ]
    if (apiConfig.useMock) return base
    try {
      const res = await fetch(`${apiConfig.backendOrigin}/api/v1/products?page=0&size=1`)
      const apiOk = res.ok
      return [
        {
          name: 'Backend API (Spring)',
          value: apiOk ? 'Online' : `HTTP ${res.status}`,
          status: apiOk ? 'ok' : 'error',
        },
        ...base,
      ]
    } catch {
      return [
        { name: 'Backend API (Spring)', value: 'Offline', status: 'error' },
        ...base,
      ]
    }
  },
}

export const adminApi = {
  async listUsers(): Promise<User[]> {
    if (apiConfig.useRealAdmin && hasBackendToken()) {
      return realUsers.listUsers()
    }
    return mockAdminApi.listUsers()
  },

  async setUserActive(userId: string, active: boolean): Promise<User> {
    if (apiConfig.useRealAdmin && hasBackendToken()) {
      await realUsers.setUserActive(userId, active)
      const users = await realUsers.listUsers()
      const u = users.find((x) => x.id === userId)
      if (!u) throw new Error('Không tìm thấy người dùng')
      return u
    }
    return mockAdminApi.setUserActive(userId, active)
  },

  async setUserRole(userId: string, role: UserRole): Promise<User> {
    if (apiConfig.useRealAdmin && hasBackendToken()) {
      await realUsers.assignRole(userId, role)
      const users = await realUsers.listUsers()
      const u = users.find((x) => x.id === userId)
      if (!u) throw new Error('Không tìm thấy người dùng')
      setRoleOverride(u.email, role)
      return u
    }
    return mockAdminApi.setUserRole(userId, role)
  },

  systemMetrics: mockAdminApi.systemMetrics,
}

// ——— Chatbot (LLM Groq/OpenAI + fallback engine local) ———
export const chatApi = {
  isLlmEnabled: isLlmConfigured,
  modeLabel: chatModeLabel,

  async ensureAiReady() {
    await refreshBeAiStatus()
  },

  async getHistory(userId: string): Promise<ChatMessage[]> {
    await delay(30)
    return getChatMap()[userId] ?? []
  },

  async send(
    userId: string,
    content: string,
    role: UserRole,
    opts?: {
      userName?: string
      sellerBackendId?: string
      attachments?: import('@/types').ChatProductRef[]
    },
  ): Promise<ChatMessage[]> {
    const map = getChatMap()
    const history = map[userId] ?? []
    const attachments = opts?.attachments?.length ? opts.attachments : undefined
    const userMsg: ChatMessage = {
      id: `c-${Date.now()}`,
      role: 'user',
      content: content.trim() || (attachments?.length ? 'Cho tôi thông tin các sản phẩm đã đính kèm.' : content),
      timestamp: new Date().toISOString(),
      attachments,
    }

    const ctx = await buildChatContext(role, {
      userName: opts?.userName,
      userId,
      sellerBackendId: opts?.sellerBackendId,
    })

    const { content: reply, source, products } = await resolveChatReply(
      userMsg.content,
      history,
      ctx,
      attachments,
    )

    // Đồng bộ tồn trên card user với card/bot (tránh "Hết hàng" vs "còn 100")
    if (userMsg.attachments?.length && products?.length) {
      userMsg.attachments = userMsg.attachments.map((a) => {
        const hit = products.find((p) => String(p.id) === String(a.id))
        return hit && typeof hit.stock === 'number'
          ? { ...a, stock: hit.stock, stockKnown: true }
          : a
      })
    }

    await delay(typingDelay(reply))

    const assistantMsg: ChatMessage = {
      id: `c-${Date.now() + 1}`,
      role: 'assistant',
      content: reply,
      timestamp: new Date().toISOString(),
      products,
      meta: { source },
    }
    const updated = [...history, userMsg, assistantMsg]
    map[userId] = updated
    saveChatMap(map)
    return updated
  },

  async clear(userId: string): Promise<void> {
    await delay(30)
    const map = getChatMap()
    delete map[userId]
    saveChatMap(map)
  },
}

export const platformRevenueApi = {
  getDashboard(query: realPlatformRevenue.PlatformRevenueDashboardQuery) {
    return realPlatformRevenue.getPlatformRevenueDashboard(query)
  },
}
