import type { Product, Recommendation } from '@/types'

export interface RecScoreParts {
  category: number
  rating: number
  popularity: number
  priceFit: number
  deal: number
}

/** Multi-factor DSS score (0–1) with explainable reasons from real catalog + purchase history. */
export function scoreProductRecommendation(
  product: Product,
  opts: {
    boughtIds: Set<string>
    categoryCounts: Map<string, number>
    avgSpend: number | null
    preferredCategories: string[]
  },
): Recommendation {
  const reasons: string[] = []
  const breakdown: { label: string; points: number }[] = []

  const topCat = opts.preferredCategories[0]
  const catHits = opts.categoryCounts.get(product.category) ?? 0
  const catPts = Math.min(0.22, catHits * 0.11)
  if (catPts > 0 && topCat && product.category === topCat) {
    reasons.push(`Khớp danh mục bạn hay mua (${product.category})`)
  } else if (catPts > 0) {
    reasons.push(`Liên quan danh mục đã mua (${product.category})`)
  }
  breakdown.push({ label: 'Danh mục', points: Math.round(catPts * 100) })

  const ratingPts = Math.min(0.2, Math.max(0, (product.rating - 3.5) / 5) * 0.2 + product.rating * 0.04)
  if (product.rating >= 4.5) reasons.push(`Đánh giá cao (${product.rating.toFixed(1)}★)`)
  else if (product.rating >= 4) reasons.push(`Rating tốt (${product.rating.toFixed(1)}★)`)
  breakdown.push({ label: 'Rating', points: Math.round(ratingPts * 100) })

  const popPts = Math.min(0.18, product.soldCount / 400)
  if (product.soldCount >= 80) reasons.push(`Bán chạy (đã bán ${product.soldCount})`)
  else if (product.soldCount >= 20) reasons.push(`Độ phổ biến ổn (${product.soldCount} lượt bán)`)
  breakdown.push({ label: 'Phổ biến', points: Math.round(popPts * 100) })

  let pricePts = 0.08
  if (opts.avgSpend != null && opts.avgSpend > 0) {
    const ratio = product.price / opts.avgSpend
    if (ratio >= 0.55 && ratio <= 1.45) {
      pricePts = 0.18
      reasons.push('Nằm trong tầm giá bạn thường chi')
    } else if (ratio < 0.55) {
      pricePts = 0.12
      reasons.push('Giá thấp hơn mức chi trung bình của bạn')
    } else {
      pricePts = 0.04
    }
  } else if (opts.boughtIds.size === 0) {
    pricePts = 0.1
  }
  breakdown.push({ label: 'Giá', points: Math.round(pricePts * 100) })

  let dealPts = 0
  if (product.isFlashSale) {
    dealPts = 0.08
    reasons.push('Đang Flash Sale')
  } else if (product.originalPrice && product.originalPrice > product.price) {
    dealPts = 0.06
    const pct = Math.round((1 - product.price / product.originalPrice) * 100)
    reasons.push(`Đang giảm ~${pct}%`)
  }
  breakdown.push({ label: 'Ưu đãi', points: Math.round(dealPts * 100) })

  const base = 0.42
  const score = Math.min(0.98, base + catPts + ratingPts + popPts + pricePts + dealPts)

  if (!reasons.length) {
    reasons.push(
      opts.boughtIds.size === 0
        ? 'Phổ biến trên SEDSP — gợi ý khám phá'
        : 'Phù hợp xu hướng mua trên sàn',
    )
  }

  return {
    productId: product.id,
    score,
    reason: reasons[0],
    reasons: reasons.slice(0, 4),
    breakdown,
  }
}

/** Rank catalog for NL “cheap but good / programming” style asks. */
export function rankForUseCase(
  products: Product[],
  raw: string,
  limit = 6,
): Product[] {
  const q = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
  const wantCheap = /re|cheap|budget|gia re|tiet kiem|duoi|ngan sach/.test(q)
  const wantQuality = /tot|ngon|chat luong|tot nhat|dang mua|good|best/.test(q)
  const wantHot =
    /(?:^|\s)hot(?:\s|$)|dang hot|ban chay|best ?seller|trending|noi bat|thinh hanh|pho bien/.test(q)
  const wantDev =
    /lap trinh|programming|code|developer|coder|sinh vien it|hoc code|vscode|dev/.test(q)

  return [...products]
    .filter((p) => (p.stock ?? 1) > 0)
    .map((p) => {
      let s = p.rating * 14 + Math.min(p.soldCount, 250) / 18
      if (wantCheap) s += Math.max(0, 18 - p.price / 1_000_000)
      if (wantQuality) s += p.rating * 4
      if (wantHot) s += Math.min(p.soldCount, 500) / 8 + (p.isFlashSale ? 6 : 0)
      if (wantDev) {
        const cat = p.category.toLowerCase()
        const name = p.name.toLowerCase()
        if (/laptop|máy tính|may tinh|macbook|notebook/.test(cat + ' ' + name)) s += 25
        if (/phụ kiện|phu kien|ban phim|chuot|tai nghe/.test(cat + ' ' + name)) s += 8
      }
      return { p, s }
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p)
}
