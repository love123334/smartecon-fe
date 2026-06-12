import {
  seedOrders,
  seedPasswords,
  seedProducts,
  seedUsers,
} from '@/api/mockData'
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
  return { ...u }
}

// ——— Auth ———
export const authApi = {
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
    patch: Partial<Pick<User, 'fullName' | 'phone' | 'address'>>,
  ): Promise<User> {
    await delay()
    const users = getUsers()
    const idx = users.findIndex((u) => u.id === userId)
    if (idx < 0) throw new Error('Không tìm thấy người dùng')
    users[idx] = { ...users[idx], ...patch }
    saveUsers(users)
    return publicUser(users[idx])
  },
}

// ——— Products ———
export const productApi = {
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

// ——— Cart ———
export const cartApi = {
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
    if (quantity <= 0) return cartApi.removeItem(userId, productId)
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

export interface CartLine {
  product: Product
  quantity: number
  subtotal: number
}

export async function resolveCartLines(userId: string): Promise<CartLine[]> {
  const items = await cartApi.getCart(userId)
  const products = getProducts()
  return items
    .map((item) => {
      const product = products.find((p) => p.id === item.productId)
      if (!product) return null
      return {
        product,
        quantity: item.quantity,
        subtotal: product.price * item.quantity,
      }
    })
    .filter((x): x is CartLine => x != null)
}

// ——— Orders ———
export const orderApi = {
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

// ——— DSS & Analytics ———
export const dssApi = {
  async sellerInsights(): Promise<DssInsight[]> {
    await delay()
    const products = getProducts().filter((p) => p.sellerId === 'u-seller')
    const lowStock = products.filter((p) => p.stock < 20)
    return [
      {
        id: 'd1',
        title: 'Nhập thêm hàng',
        description:
          lowStock.length > 0
            ? `${lowStock.map((p) => p.name).join(', ')} sắp hết hàng.`
            : 'Tồn kho ổn định.',
        impact: lowStock.length > 0 ? 'high' : 'low',
        category: 'inventory',
      },
      {
        id: 'd2',
        title: 'Điều chỉnh giá cạnh tranh',
        description: 'Giày chạy bộ AirFlex có thể giảm 5% để tăng chuyển đổi.',
        impact: 'medium',
        category: 'pricing',
      },
      {
        id: 'd3',
        title: 'Khuyến mãi chéo',
        description: 'Gợi ý bundle tai nghe + bàn phím cho khách điện tử.',
        impact: 'medium',
        category: 'promotion',
      },
    ]
  },

  async managerInsights(): Promise<DssInsight[]> {
    await delay()
    const orders = getOrders()
    const revenue = orders.reduce((s, o) => s + o.total, 0)
    return [
      {
        id: 'm1',
        title: 'Tăng trưởng doanh thu',
        description: `Doanh thu tích lũy ${formatVnd(revenue)}. Dự báo +12% tháng tới.`,
        impact: 'high',
        category: 'revenue',
      },
      {
        id: 'm2',
        title: 'Phân khúc khách hàng',
        description: 'Nhóm khách mua điện tử chiếm 45% GMV.',
        impact: 'medium',
        category: 'segment',
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

  async salesChart(): Promise<ChartPoint[]> {
    await delay()
    return [
      { label: 'T1', value: 12_500_000 },
      { label: 'T2', value: 15_200_000 },
      { label: 'T3', value: 14_800_000 },
      { label: 'T4', value: 18_900_000 },
      { label: 'T5', value: 22_100_000 },
      { label: 'T6', value: 25_300_000 },
    ]
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
    const orders = getOrders().filter((o) => o.customerId === customerId)
    const bought = new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))
    const products = getProducts().filter((p) => !bought.has(p.id))
    return products.slice(0, 4).map((p, i) => ({
      productId: p.id,
      score: 0.95 - i * 0.08,
      reason:
        i === 0
          ? 'Dựa trên lịch sử mua hàng của bạn'
          : 'Khách hàng tương tự cũng mua',
    }))
  },
}

// ——— Admin ———
export const adminApi = {
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
    return [
      { name: 'API Gateway', value: '99.9%', status: 'ok' },
      { name: 'PostgreSQL', value: 'Connected', status: 'ok' },
      { name: 'Redis', value: '12ms latency', status: 'ok' },
      { name: 'n8n Workflows', value: '3 active', status: 'ok' },
      { name: 'Order Queue', value: 2, status: 'warn' },
      { name: 'Error Rate (1h)', value: '0.02%', status: 'ok' },
    ]
  },
}

// ——— Chatbot ———
const BOT_REPLIES: Record<string, string[]> = {
  default: [
    'Tôi có thể giúp bạn tìm sản phẩm, theo dõi đơn hàng hoặc gợi ý khuyến mãi.',
    'Bạn muốn xem sản phẩm nào hôm nay?',
  ],
  đơn: ['Bạn có thể xem đơn hàng tại mục "Đơn hàng của tôi".'],
  giá: ['Giá đã bao gồm VAT. Thanh toán COD hoặc chuyển khoản.'],
  tồn: ['Tồn kho được cập nhật theo thời gian thực trên hệ thống SEDSP.'],
}

function botReply(text: string, role: UserRole): string {
  const lower = text.toLowerCase()
  if (role === 'seller' || role === 'manager') {
    if (lower.includes('doanh thu') || lower.includes('bán')) {
      return 'Doanh thu tháng này tăng 12% so với tháng trước. Xem biểu đồ tại Bảng điều khiển.'
    }
    if (lower.includes('tồn') || lower.includes('kho')) {
      return 'Có 2 SKU dưới ngưỡng an toàn. Kiểm tra mục Tồn kho.'
    }
  }
  for (const [key, replies] of Object.entries(BOT_REPLIES)) {
    if (key !== 'default' && lower.includes(key)) {
      return replies[Math.floor(Math.random() * replies.length)]
    }
  }
  const defaults = BOT_REPLIES.default
  return defaults[Math.floor(Math.random() * defaults.length)]
}

export const chatApi = {
  async getHistory(userId: string): Promise<ChatMessage[]> {
    await delay(30)
    return getChatMap()[userId] ?? []
  },

  async send(userId: string, content: string, role: UserRole): Promise<ChatMessage[]> {
    await delay(200)
    const map = getChatMap()
    const history = map[userId] ?? []
    const userMsg: ChatMessage = {
      id: `c-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    const assistantMsg: ChatMessage = {
      id: `c-${Date.now() + 1}`,
      role: 'assistant',
      content: botReply(content, role),
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
