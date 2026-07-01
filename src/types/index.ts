export type UserRole = 'guest' | 'customer' | 'seller' | 'manager' | 'admin'

export interface User {
  id: string
  /** ID thật từ backend — dùng cho API products/seller */
  backendId?: string
  email: string
  fullName: string
  role: UserRole
  phone?: string
  address?: string
  /** Icon preset id — xem utils/avatar */
  avatarPreset?: string
  /** Data URL hoặc URL ảnh tùy chỉnh */
  avatarUrl?: string
  createdAt: string
  active: boolean
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  /** Giá gốc trước giảm — hiển thị gạch ngang trên marketplace */
  originalPrice?: number
  stock: number
  category: string
  imageUrl: string
  sellerId: string
  shopName?: string
  shopLocation?: string
  rating: number
  reviewCount?: number
  soldCount: number
  isFlashSale?: boolean
  createdAt: string
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipping'
  | 'delivered'
  | 'cancelled'

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export interface Order {
  id: string
  customerId: string
  customerName: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  shippingAddress: string
  paymentMethod?: 'cod' | 'bank' | 'card'
  createdAt: string
  updatedAt: string
}

export interface CartItem {
  productId: string
  quantity: number
  cartItemId?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  /** Bot đang gõ phản hồi */
  pending?: boolean
}

export interface DssInsight {
  id: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  category: string
}

export interface ChartPoint {
  label: string
  value: number
}

export interface SystemMetric {
  name: string
  value: string | number
  status: 'ok' | 'warn' | 'error'
}

export interface Recommendation {
  productId: string
  score: number
  reason: string
}
