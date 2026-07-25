import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { SpringPage } from '@/api/real/products'
import type { ProductReview, RatingSummary } from '@/types'

interface BackendReview {
  id: number
  userId: number
  userName: string
  rating: number
  comment: string
  createdAt?: string
}

interface BackendRatingSummary {
  averageRating: number
  totalReviews: number
}

function mapReview(r: BackendReview): ProductReview {
  return {
    id: String(r.id),
    userId: String(r.userId),
    userName: r.userName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt ?? new Date().toISOString(),
  }
}

export async function listReviews(
  productId: string,
  page = 0,
  size = 20,
): Promise<ProductReview[]> {
  const data = await http.get<SpringPage<BackendReview>>(
    `${apiPaths.reviews.list(productId)}?page=${page}&size=${size}`,
  )
  return data.content.map(mapReview)
}

export async function getRatingSummary(productId: string): Promise<RatingSummary> {
  const data = await http.get<BackendRatingSummary>(apiPaths.reviews.summary(productId))
  return {
    averageRating: data.averageRating ?? 0,
    totalReviews: data.totalReviews ?? 0,
  }
}

export async function createReview(
  productId: string,
  input: { rating: number; comment: string },
): Promise<ProductReview> {
  const data = await http.post<BackendReview>(apiPaths.reviews.list(productId), input)
  return mapReview(data)
}

export async function updateReview(
  productId: string,
  reviewId: string,
  input: { rating: number; comment: string },
): Promise<ProductReview> {
  const data = await http.put<BackendReview>(
    apiPaths.reviews.byId(productId, reviewId),
    input,
  )
  return mapReview(data)
}

export async function deleteReview(productId: string, reviewId: string): Promise<void> {
  await http.delete<void>(apiPaths.reviews.byId(productId, reviewId))
}
