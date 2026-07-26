import type { Product } from '@/types'

/** Nhãn hiển thị shop — chuẩn bị multi-seller */
export function sellerDisplayName(product: Pick<Product, 'shopName' | 'sellerId'>): string {
  const name = product.shopName?.trim()
  if (name) return name
  if (product.sellerId) return `Shop #${product.sellerId}`
  return 'SEDSP Official'
}

/** Tag ngắn gắn trên card (ổn định theo sellerId) */
export function sellerTagCode(sellerId: string | undefined): string {
  if (!sellerId) return 'SEDSP'
  const n = Number(sellerId)
  if (!Number.isNaN(n) && n > 0) return `S${n}`
  const short = sellerId.replace(/\W/g, '').slice(-4).toUpperCase()
  return short ? `S-${short}` : 'SHOP'
}

/** Hue ổn định 0–359 từ sellerId — màu tag khác nhau giữa các shop */
export function sellerTagHue(sellerId: string | undefined): number {
  const s = sellerId || 'sedsp'
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 360
  }
  return h
}

export function sellerTagStyle(sellerId: string | undefined): Record<string, string> {
  const hue = sellerTagHue(sellerId)
  return {
    '--seller-hue': String(hue),
    background: `hsl(${hue} 42% 92%)`,
    color: `hsl(${hue} 45% 28%)`,
    borderColor: `hsl(${hue} 35% 72%)`,
  }
}
