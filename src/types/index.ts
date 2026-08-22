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
  /** Giá vốn / giá nhập — seller nhập để DSS tính lợi nhuận (không hiện catalog công khai) */
  costPrice?: number
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
  /** Thuộc tính bổ sung từ backend (Thương hiệu, Xuất xứ, …) */
  attributes?: ProductAttribute[]
}

export interface ProductAttribute {
  name: string
  value: string
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

export interface MomoTransferInfo {
  amount: number
  transferNote: string
  sellerMomoPhone?: string | null
  sellerMomoQrUrl?: string | null
  sellerStoreName?: string | null
  configured: boolean
}

export interface Order {
  id: string
  customerId: string
  customerName: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  shippingAddress: string
  paymentMethod?: 'momo' | 'momo_qr' | 'vnpay' | 'cod' | 'bank' | 'card'
  /** Trạng thái gốc từ backend (PENDING, PROCESSING, …) */
  rawStatus?: string
  /** Hướng dẫn chuyển MoMo tới shop (MOMO_QR) */
  momoTransfer?: MomoTransferInfo
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

/** Danh thiếp shop / người bán trong chat — chỉ thông tin công khai, không doanh thu */
export interface ChatSellerRef {
  sellerId: string
  shopName: string
  shopLocation?: string
  productCount?: number
  avgRating?: number
  totalReviews?: number
  totalSold?: number
  tagCode?: string
  avatarInitial?: string
  topCategories?: string[]
  sampleProducts?: { id: string; name: string }[]
  /** Chỉ hiện khi user hỏi liên hệ / người bán */
  sellerEmail?: string
  sellerPhone?: string
  showContact?: boolean
}

export interface ChatReviewHighlight {
  id: string
  userName: string
  rating: number
  comment: string
}

/** Tổng hợp đánh giá SP — render card trong chat */
export interface ChatReviewSummary {
  productId: string
  productName: string
  averageRating: number
  totalReviews: number
  soldCount: number
  hasReviews: boolean
  purchaseInsight?: string
  origin?: string
  shopName?: string
  price?: number
  highlights: ChatReviewHighlight[]
}

/** Nút gợi ý câu hỏi tiếp theo trong chat */
export interface ChatSuggestedAction {
  id: string
  label: string
  prompt: string
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
  /** Danh thiếp shop khi hỏi người bán / chỗ bán */
  sellers?: ChatSellerRef[]
  /** Tổng hợp đánh giá (card trực quan) */
  reviewSummary?: ChatReviewSummary
  meta?: {
    source?: 'llm' | 'local' | 'llm_repaired'
    kind?: 'order_update' | 'system'
    notificationId?: number
    orderId?: number
    intent?: string
    /** Gợi ý hành động — chỉ hiện ở bubble assistant mới nhất */
    suggestedActions?: ChatSuggestedAction[]
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
