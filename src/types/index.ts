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
  /** Gallery URLs (primary first) — always prefer ≥3 for PDP thumbs */
  imageUrls?: string[]
  sellerId: string
  /** Email người bán — từ API product detail */
  sellerEmail?: string
  /** SĐT người bán — từ API product detail */
  sellerPhone?: string
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

/** Nguồn dữ liệu đơn hàng seller trên frontend */
export type SellerOrdersSource = 'api' | 'dashboard' | 'mock'

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
  paymentMethod?: 'momo' | 'vnpay' | 'cod' | 'bank' | 'card'
  /** Trạng thái gốc từ backend (PENDING, PROCESSING, …) */
  rawStatus?: string
  createdAt: string
  updatedAt: string
}

export interface CartItem {
  productId: string
  quantity: number
  cartItemId?: string
}

/** SP rút gọn dùng trong chat (card / đính kèm) */
export interface ChatProductRef {
  id: string
  name: string
  price: number
  imageUrl: string
  category?: string
  stock?: number
  /** true = tồn lấy từ inventory/catalog withStock — mới được báo hết hàng */
  stockKnown?: boolean
  shopName?: string
  rating?: number
  originalPrice?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  /** Bot đang gõ phản hồi */
  pending?: boolean
  /** Card SP gắn với tin nhắn (kết quả tìm / gợi ý / so sánh) */
  products?: ChatProductRef[]
  /** SP người dùng kéo-thả đính kèm khi hỏi */
  attachments?: ChatProductRef[]
  meta?: {
    source?: 'llm' | 'local'
  }
}

export interface DssInsight {
  id: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  category: string
  actionUrl?: string
  actionLabel?: string
  priorityLabel?: string
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
  /** Primary one-line reason */
  reason: string
  /** Explainable checklist (DSS) */
  reasons?: string[]
  /** Score contribution labels (0–100 scale points) */
  breakdown?: { label: string; points: number }[]
}

export interface ProductReview {
  id: string
  userId: string
  userName: string
  rating: number
  comment: string
  createdAt: string
}

export interface RatingSummary {
  averageRating: number
  totalReviews: number
}
