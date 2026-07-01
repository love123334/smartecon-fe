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
import * as realCategories from '@/api/real/categories'
import * as realInventory from '@/api/real/inventory'
import * as realUsers from '@/api/real/users'
import { generateAssistantReply, typingDelay } from '@/api/chat/engine'
import { applyAvatarToUser, saveUserAvatar } from '@/utils/avatar'
import { STORAGE_KEYS, storageGet, storageSet } from '@/api/storage'
import type {
  CartItem,
  ChartPoint,
  ChatMessage,
  DssInsight,
  Order,
  OrderItem,
  Product,
  Recommendation,
  SystemMetric,
  User,
  UserRole,
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
    shopName: p.shopName ?? 'SEDSP Official',
    shopLocation: p.shopLocation ?? 'TP.HCM',
    originalPrice: p.originalPrice ?? Math.round(p.price * 1.12),
    reviewCount: p.reviewCount ?? Math.max(1, Math.floor(p.soldCount * 0.4)),
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
    return publicUser(user)
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
          return await realAuth.login(email, password)
        } catch (e) {
          if (isBackendUnreachableError(e)) {
            return mockLoginAcceptingDemoPassword(email, password)
          }
          throw e
        }
      },
      register: realAuth.register,
      logout: realAuth.logout,
      getCurrentUser: async () => {
        if (isMockSession()) {
          return mockAuthApi.getCurrentUser()
        }
        try {
          return await realAuth.getCurrentUser()
        } catch (e) {
          if (isBackendUnreachableError(e)) {
            return mockAuthApi.getCurrentUser()
          }
          return null
        }
      },
      updateProfile: async (
        userId: string,
        patch: Partial<Pick<User, 'fullName' | 'phone' | 'address' | 'avatarPreset' | 'avatarUrl'>>,
      ) => {
        if (isMockSession()) {
          return mockAuthApi.updateProfile(userId, patch)
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
          return applyAvatarToUser({
            ...me,
            avatarPreset: patch.avatarPreset ?? me.avatarPreset,
            avatarUrl: patch.avatarUrl ?? me.avatarUrl,
          })
        }

        try {
          const updated = await realAuth.updateProfile(userId, patch)
          if (patch.avatarPreset !== undefined || patch.avatarUrl !== undefined) {
            saveUserAvatar(userId, {
              avatarPreset: patch.avatarPreset ?? updated.avatarPreset,
              avatarUrl: patch.avatarUrl ?? updated.avatarUrl,
            })
            return applyAvatarToUser({
              ...updated,
              avatarPreset: patch.avatarPreset ?? updated.avatarPreset,
              avatarUrl: patch.avatarUrl ?? updated.avatarUrl,
            })
          }
          return updated
        } catch (e) {
          if (isBackendUnreachableError(e)) {
            return mockAuthApi.updateProfile(userId, patch)
          }
          throw e
        }
      },
    }
  : mockAuthApi

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

async function listProductsHybrid(params?: {
  q?: string
  category?: string
  sellerId?: string
  withStock?: boolean
}): Promise<Product[]> {
  if (!apiConfig.useRealProducts) {
    return mockProductApi.list(params)
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

    let list = await realProducts.listProducts({
      q: params?.q,
      sellerId: sellerNum,
      categoryId,
      size: 100,
    })

    if (params?.category && !categoryId) {
      list = list.filter(
        (p) => p.category.toLowerCase() === params.category!.toLowerCase(),
      )
    }
    if (params?.sellerId && !sellerNum) {
      list = list.filter((p) => p.sellerId === params.sellerId)
    }

    let enriched = list.map(enrichProduct)
    if (apiConfig.useRealInventory && (params?.withStock ?? true) && hasBackendToken()) {
      enriched = await realInventory.attachStockToProducts(enriched)
    }
    return enriched
  } catch {
    return mockProductApi.list(params)
  }
}

export const productApi = {
  list: listProductsHybrid,

  async getById(id: string): Promise<Product | null> {
    if (apiConfig.useRealProducts) {
      try {
        let p = await realProducts.getProductById(id)
        if (!p) return null
        p = enrichProduct(p)
        if (apiConfig.useRealInventory && hasBackendToken()) {
          const [withStock] = await realInventory.attachStockToProducts([p])
          return withStock
        }
        return p
      } catch {
        /* fallback mock */
      }
    }
    return mockProductApi.getById(id)
  },

  async create(
    _sellerId: string,
    data: Omit<Product, 'id' | 'sellerId' | 'createdAt' | 'soldCount' | 'rating'> & {
      categoryId?: number
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
      })
      if (data.stock > 0 && apiConfig.useRealInventory) {
        try {
          await realInventory.adjustInventory(created.id, data.stock, 'MANUAL_ADJUST')
        } catch {
          /* inventory row may not exist yet */
        }
      }
      return enrichProduct({ ...created, stock: data.stock })
    }
    return mockProductApi.create(_sellerId, data)
  },

  async update(
    id: string,
    patch: Partial<Product> & { categoryId?: number; stockDelta?: number },
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
      })
      if (patch.stockDelta != null && patch.stockDelta !== 0 && apiConfig.useRealInventory) {
        try {
          await realInventory.adjustInventory(id, patch.stockDelta, 'MANUAL_ADJUST')
        } catch {
          /* ignore */
        }
      }
      const [withStock] = await realInventory.attachStockToProducts([enrichProduct(updated)])
      return withStock
    }
    return mockProductApi.update(id, patch)
  },

  async remove(id: string): Promise<void> {
    if (apiConfig.useRealProducts && hasBackendToken()) {
      await realProducts.deleteProduct(id)
      return
    }
    return mockProductApi.remove(id)
  },

  async categories(): Promise<string[]> {
    if (apiConfig.useRealCategories) {
      try {
        return await realCategories.categoryNames()
      } catch {
        /* fallback */
      }
    }
    return mockProductApi.categories()
  },
}

export const categoryApi = {
  async list(): Promise<realCategories.Category[]> {
    if (apiConfig.useRealCategories) {
      return realCategories.listCategories()
    }
    const names = await mockProductApi.categories()
    return names.map((name, i) => ({
      id: String(i + 1),
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
    }))
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
  return item ? String(item.id) : null
}

export const cartApi = {
  async getCart(userId: string): Promise<CartItem[]> {
    if (apiConfig.useRealCart && hasBackendToken()) {
      const cart = await realCart.getCart()
      return cart.items.map((i) => ({
        productId: String(i.productId),
        quantity: i.quantity,
        cartItemId: String(i.id),
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
    return cart.items.map((item) => {
      const price = realCart.cartNum(item.price)
      const subtotal = realCart.cartNum(item.totalPrice, price * item.quantity)
      return {
        cartItemId: String(item.id),
        product: {
          id: String(item.productId),
          name: item.productName,
          description: '',
          price,
          stock: 99,
          category: '',
          imageUrl: `https://picsum.photos/seed/prod-${item.productId}/400/400`,
          sellerId: '',
          shopName: 'SEDSP Official',
          shopLocation: 'TP.HCM',
          rating: 4.5,
          soldCount: 0,
          createdAt: new Date().toISOString(),
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
    _payment?: 'cod' | 'bank' | 'card',
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
  const mock = await mockOrderApi.listAll()
  if (!apiConfig.useRealOrders || !hasBackendToken()) return mock
  try {
    const real = await realOrders.listMyOrders(0, 100)
    const byId = new Map<string, Order>()
    for (const o of mock) byId.set(o.id, o)
    for (const o of real) byId.set(o.id, o)
    return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    return mock
  }
}

export const orderApi = {
  async listForCustomer(customerId: string): Promise<Order[]> {
    if (apiConfig.useRealOrders && hasBackendToken()) {
      return realOrders.listMyOrders()
    }
    return mockOrderApi.listForCustomer(customerId)
  },

  async listAll(): Promise<Order[]> {
    return mergedAllOrders()
  },

  async getById(id: string): Promise<Order | null> {
    if (apiConfig.useRealOrders && hasBackendToken()) {
      return realOrders.getOrderById(id)
    }
    return mockOrderApi.getById(id)
  },

  async placeOrder(
    customerId: string,
    shippingAddress: string,
    payment: 'cod' | 'bank' | 'card' = 'cod',
  ): Promise<Order> {
    if (apiConfig.useRealOrders && hasBackendToken()) {
      const order = await realOrders.createOrder(
        shippingAddress,
        realOrders.toBackendPayment(payment),
      )
      return order
    }
    return mockOrderApi.placeOrder(customerId, shippingAddress, payment)
  },

  async updateStatus(id: string, status: Order['status']): Promise<Order> {
    if (apiConfig.useRealOrders && hasBackendToken()) {
      if (status === 'cancelled') {
        await realOrders.cancelOrder(id)
        const order = await realOrders.getOrderById(id)
        if (!order) throw new Error('Đơn hàng không tồn tại')
        return order
      }
      throw new Error('Chỉ hỗ trợ hủy đơn qua API backend')
    }
    return mockOrderApi.updateStatus(id, status)
  },
}

// ——— DSS & Analytics ———
export const dssApi = {
  async sellerInsights(sellerKey?: string): Promise<DssInsight[]> {
    await delay()
    let products: Product[] = []
    try {
      products = await listProductsHybrid({
        sellerId: sellerKey,
        withStock: true,
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
    return [
      {
        id: 'm1',
        title: 'Tăng trưởng doanh thu',
        description: `Doanh thu tích lũy ${formatVnd(revenue)} từ ${orders.length} đơn. Dự báo +12% tháng tới.`,
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
        title: 'What-if: giảm giá 10%',
        description: 'Mô phỏng: đơn hàng +18%, biên lợi nhuận -3%.',
        impact: 'medium',
        category: 'whatif',
      },
    ]
  },

  async salesChart(sellerKey?: string): Promise<ChartPoint[]> {
    await delay()
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
    await delay()
    let orders = getOrders().filter((o) => o.customerId === customerId)
    if (apiConfig.useRealOrders && hasBackendToken()) {
      try {
        const real = await realOrders.listMyOrders()
        orders = [...orders, ...real]
      } catch {
        /* keep mock orders */
      }
    }

    const bought = new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))
    const boughtCategories = new Map<string, number>()
    for (const o of orders) {
      for (const item of o.items) {
        const p = getProducts().find((x) => x.id === item.productId)
        if (p) boughtCategories.set(p.category, (boughtCategories.get(p.category) ?? 0) + 1)
      }
    }

    let catalog: Product[] = []
    try {
      catalog = await listProductsHybrid()
    } catch {
      catalog = getProducts()
    }

    const candidates = catalog.filter((p) => !bought.has(p.id))
    const ranked = candidates
      .map((p) => {
        const catBoost = (boughtCategories.get(p.category) ?? 0) * 0.12
        const ratingBoost = p.rating * 0.08
        const popularBoost = Math.min(p.soldCount / 200, 0.15)
        const score = Math.min(0.98, 0.55 + catBoost + ratingBoost + popularBoost)
        const topCat = [...boughtCategories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
        const reason =
          bought.size === 0
            ? 'Phổ biến trên SEDSP — bắt đầu khám phá'
            : topCat && p.category === topCat
              ? `Bạn thường mua ${topCat} — gợi ý bổ sung`
              : 'Khách hàng tương tự cũng quan tâm'
        return { productId: p.id, score, reason }
      })
      .sort((a, b) => b.score - a.score)

    return ranked.slice(0, 6)
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
      return u
    }
    return mockAdminApi.setUserRole(userId, role)
  },

  systemMetrics: mockAdminApi.systemMetrics,
}

// ——— Chatbot (local AI engine — sẵn sàng thay bằng POST /api/v1/ai/chat) ———
export const chatApi = {
  async getHistory(userId: string): Promise<ChatMessage[]> {
    await delay(30)
    return getChatMap()[userId] ?? []
  },

  async send(
    userId: string,
    content: string,
    role: UserRole,
    opts?: { userName?: string },
  ): Promise<ChatMessage[]> {
    const map = getChatMap()
    const history = map[userId] ?? []
    const userMsg: ChatMessage = {
      id: `c-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }

    let products: Product[] = []
    try {
      products = await listProductsHybrid()
    } catch {
      products = getProducts()
    }

    const reply = generateAssistantReply(content, {
      role,
      products,
      userName: opts?.userName,
    })

    await delay(typingDelay(reply))

    const assistantMsg: ChatMessage = {
      id: `c-${Date.now() + 1}`,
      role: 'assistant',
      content: reply,
      timestamp: new Date().toISOString(),
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
