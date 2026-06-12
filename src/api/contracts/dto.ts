/**
 * API DTO contract — mirror của types FE + payload backend cần trả.
 * Backend implement đúng shape này; FE unwrap từ ApiResponse.data.
 *
 * @see docs/BACKEND-HANDOFF.md
 */

export type ApiRole = 'ADMIN' | 'MANAGER' | 'SELLER' | 'CUSTOMER'

export type OrderStatusDto =
  | 'pending'
  | 'confirmed'
  | 'shipping'
  | 'delivered'
  | 'cancelled'

export interface UserDto {
  id: string
  email: string
  fullName: string
  role: ApiRole
  phone?: string
  address?: string
  createdAt: string
  active: boolean
}

export interface LoginRequestDto {
  email: string
  password: string
}

export interface LoginResponseDto {
  accessToken: string
  user: UserDto
}

export interface RegisterRequestDto {
  email: string
  password: string
  fullName: string
  phone?: string
}

export interface ProductDto {
  id: string
  name: string
  description: string
  price: number
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

export interface CartItemDto {
  productId: string
  quantity: number
}

export interface OrderItemDto {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export interface OrderDto {
  id: string
  customerId: string
  customerName: string
  items: OrderItemDto[]
  total: number
  status: OrderStatusDto
  shippingAddress: string
  createdAt: string
  updatedAt: string
}

export interface CheckoutRequestDto {
  shippingAddress: string
}

export interface ChartPointDto {
  label: string
  value: number
}

export interface DssInsightDto {
  id: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  category: string
}

export interface RecommendationDto {
  productId: string
  score: number
  reason: string
}

export interface ChatRequestDto {
  message: string
}

export interface ChatMessageDto {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface SystemMetricDto {
  name: string
  value: string | number
  status: 'ok' | 'warn' | 'error'
}

/** Generic wrapper — backend bắt buộc */
export interface ApiResponseDto<T> {
  success: boolean
  message: string
  data: T
  errors?: Array<{ field: string; message: string }>
}
