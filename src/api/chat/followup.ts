import type { ChatMessage, ChatProductRef } from '@/types'
import type { VerifiedFacts } from '@/api/chat/verifiedFacts'
import { extractVndNumbers } from '@/api/chat/verifiedFacts'
import { asksProductPrice, asksProductReview } from '@/api/chat/match'
import { isStandaloneShoppingQuery } from '@/api/chat/discovery'
import type { ChatIntent } from '@/api/chat/intents'

/** SP vừa được bàn trong hội thoại (card bot hoặc đính kèm user). */
export function lastDiscussedProducts(history: ChatMessage[]): ChatProductRef[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    if (m.products?.length) return m.products
    if (m.attachments?.length) return m.attachments
  }
  return []
}

const BROWSE_INTENTS = new Set<ChatIntent>([
  'category_browse',
  'product_search',
  'product_budget',
  'product_cheapest',
  'recommend',
  'where_to_buy',
])

/** Chủ đề rõ ràng không phải follow-up SP */
export function isClearTopicSwitch(normalized: string): boolean {
  if (isStandaloneShoppingQuery(normalized)) return true
  return /(?:^|\s)(don hang|don cua|gio hang|thanh toan|dang nhap|dang ky|mat khau|khuyen mai|flash sale|danh muc|web ban gi|ban gi vay|sedsp la gi|lien he|khieu nai|doi tra|bao hanh|doanh thu|du bao nhu cau|what\s*if)(?:\s|$)/.test(
    normalized,
  )
}

export function isBrowseOrSearchIntent(intent: ChatIntent | null | undefined): boolean {
  return intent != null && BROWSE_INTENTS.has(intent)
}

/**
 * Câu follow-up về thuộc tính SP (không nhắc lại tên) —
 * cần gắn lại context sản phẩm vừa nói.
 */
export function isProductFollowUp(normalized: string): boolean {
  if (!normalized || normalized.length > 80) return false

  if (
    /cong dung|dung lam|dung de|mo ta|tinh nang|dac diem|gioi thieu|what (is|does)|ve no|ve cai nay|san pham nay|sp nay|cai nay|no the nao|dung nhu the nao|cho minh biet|chat luong|nghe duoc|pin tru|mau sac|size|kich thuoc|bao nhieu tien|gia bao nhieu|con hang|het hang|con khong|tot khong|review|danh gia|no la gi|sp nay sao|hang nay sao|giai thich|xuat xu|ngay len ke|len ke|bao lau|khi nao len|khach.*danh gia|danh gia.*khach|khach.*thay|thay sao|y kien khach|nguoi mua|nguoi ta nghi|moi nguoi nghi|nguoi ta thay|dang mua khong|co nen mua|shop nay|thong tin shop|lien he nguoi ban|danh thiep/.test(
      normalized,
    )
  ) {
    return true
  }

  if (
    /^(gia|bao nhieu|con hang|het hang|con khong|tot khong|review|danh gia|so sanh|compare|chi tiet|tiep di|them di)(\b|$)/.test(
      normalized,
    )
  ) {
    return true
  }

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length <= 5) {
    return /^(la gi|gia bao nhieu|bao nhieu tien|con hang khong|het hang chua|tot khong|nhu the nao|the nao|con bao nhieu|sao vay|the nao vay|sao|on khong|duoc khong|nghi sao|nghi the nao)$/.test(
      normalized,
    )
  }

  return false
}

/**
 * Câu ngắn / đại từ khi vừa bàn SP — coi là tiếp tục về SP đó
 * trừ khi đổi chủ đề rõ (đơn, giỏ, đăng nhập…).
 */
export function isContinuingProductChat(
  normalized: string,
  hasPriorProducts: boolean,
): boolean {
  if (!hasPriorProducts || !normalized) return false
  if (isStandaloneShoppingQuery(normalized)) return false
  if (isProductFollowUp(normalized)) return true
  if (isClearTopicSwitch(normalized)) return false
  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length > 8) return false
  const shortAck = /^(ok|oke|uhm|vay|vay a|vay ha|duoc|roi)$/.test(normalized)
  const priceCue = /\b(gia bao nhieu|gia ca|bao nhieu tien|gia re|gia tot|gia nay)\b/.test(normalized)
  const productCue =
    /\b(hang|sp|san pham|mua|tot|con|het|bao|nhu|the)\b/.test(normalized) ||
    (/\bgia\b/.test(normalized) && !/\bgia dung\b/.test(normalized) && priceCue)
  // Đại từ / hỏi thêm ngắn
  return /^(no|cai do|cai nay|sp nay|hang nay|tiep|them|chi tiet|giai thich|noi them|con gi|sao|the nao)/.test(
    normalized,
  ) || (words.length <= 4 && !shortAck && productCue)
}

/** LLM trả lời lệch (giải thích platform) khi user hỏi về SP */
export function looksLikeOffTopicPlatformReply(
  userNormalized: string,
  reply: string,
): boolean {
  const r = reply
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const askedProduct =
    /dung lam|cong dung|mo ta|tinh nang|gia|con hang|tot khong|review|so sanh|ve no|cai nay|sp nay/.test(
      userNormalized,
    )
  if (!askedProduct) return false
  return (
    /smart e-commerce decision support|catalog vi\s*~?\s*55|dss \(nhu cau|what-if\) & ai ho tro quyet dinh|mua sam \(catalog/.test(
      r,
    ) || (/sedsp —/.test(r) && /quyet dinh/.test(r) && r.length < 420)
  )
}

/** Gemini / LLM đôi khi lộ metadata safety thay vì câu trả lời thật */
export function looksLikeSafetyMetadataLeak(reply: string): boolean {
  const r = reply.trim()
  if (!r) return true
  const n = r
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const safetyHits =
    (n.match(/user safety|response safety|phan hoi an toan|khoan nguoi dung|khong che nguoi dung/g) ?? [])
      .length
  if (safetyHits >= 2) return true
  if (safetyHits >= 1 && r.length < 120) return true
  return /^user safety:\s*safe\s*$/im.test(r) || /^response safety:\s*safe\s*$/im.test(r)
}

/** Câu trả lời cứng/ngớ (template CSKH, không đáp đúng câu hỏi) */
export function looksLikeLowQualityReply(userNormalized: string, reply: string): boolean {
  const r = reply
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  if (!r || r.length < 20) return true
  if (
    /toi co the giup|ban muon hoi gi|hay cho minh biet them|ban can ho tro gi|minh co the ho tro ban ve|cac chuc nang chinh cua sedsp/.test(
      r,
    ) ||
    /minh loc duoc.*moi xem thu ben duoi|keo sp vao chat de so sanh nhanh/.test(r)
  ) {
    return true
  }
  if (/theo quy dinh cua (he thong|san)|du lieu cho thay rang|he thong ho tro cac/.test(r)) {
    return true
  }
  // User hỏi cụ thể (giá/mua/tìm) mà bot chỉ giới thiệu platform
  const askedShop =
    /gia|mua|tim|co ban|duoi|trieu|laptop|tai nghe|iphone|macbook|don|gio|shop/.test(userNormalized)
  if (
    askedShop &&
    /smart e-commerce|quyet dinh mua sam|dss & ai/.test(r) &&
    !/dong|trieu|vnd|shop|con hang|het hang|\d/.test(r)
  ) {
    return true
  }
  return false
}

/** User hỏi giá/số liệu mà LLM không nhắc số đã xác minh */
export function llmMissingCriticalFacts(
  userNormalized: string,
  llmContent: string,
  facts: VerifiedFacts,
): boolean {
  const askedPrice =
    /gia|bao nhieu|how much|price|tien|trieu|ngan sach|duoi|budget/.test(userNormalized)
  const askedStock = /con hang|het hang|ton|stock|con khong/.test(userNormalized)
  const askedProduct =
    /tim|mua|goi y|re nhat|san pham|sp |tai nghe|laptop|iphone|macbook|so sanh/.test(
      userNormalized,
    )

  if (asksProductReview(userNormalized)) {
    const hasRatingFact = facts.lines.some(
      (l) => /danh gia tb|review|★/i.test(l) || /\d\.\d.*★/.test(l),
    )
    if (hasRatingFact && !/\d[\d.,]*\s*★|★|\d\.\d\s*\/\s*5|sao/.test(llmContent)) {
      return true
    }
  }

  if (askedPrice && facts.verifiedPricesVnd.length > 0) {
    const llmPrices = extractVndNumbers(llmContent)
    const hasMatch = facts.verifiedPricesVnd.some((expected) =>
      llmPrices.some((got) => Math.abs(got - expected) <= expected * 0.02 + 1000),
    )
    const mentionsProduct = facts.allowedProductNames.some((n) => {
      const key = n.trim().toLowerCase()
      if (key.length < 3) return false
      return llmContent.toLowerCase().includes(key.slice(0, Math.min(key.length, 18)))
    })
    // Cards show price — conversational lean on a named SP is enough for browse/budget.
    if (mentionsProduct && facts.products.length > 0 && !asksProductPrice(userNormalized)) {
      return false
    }
    if (!hasMatch && !/\d[\d.,]{2,}/.test(llmContent)) return true
  }

  if (askedStock && facts.localDraft && /het hang|con \d+|ton \d+|còn \d+/i.test(facts.localDraft)) {
    if (!/het hang|con \d+|ton|hết hàng|còn \d+/i.test(llmContent)) return true
  }

  if (
    askedProduct &&
    facts.allowedProductNames.length > 0 &&
    facts.allowedProductNames.length <= 4
  ) {
    const mentionsAny = facts.allowedProductNames.some((name) => {
      const key = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3)
        .slice(0, 2)
        .join(' ')
      return (
        key.length >= 4 &&
        llmContent.toLowerCase().includes(key.slice(0, Math.min(key.length, 12)))
      )
    })
    if (!mentionsAny && llmContent.length < 180) return true
  }

  return false
}

/** LLM bịa giá khác biệt lớn so với facts */
export function llmContradictsFacts(llmContent: string, facts: VerifiedFacts): boolean {
  if (!facts.verifiedPricesVnd.length) return false
  const llmPrices = extractVndNumbers(llmContent)
  if (!llmPrices.length) return false
  return llmPrices.some((got) =>
    facts.verifiedPricesVnd.every(
      (expected) => Math.abs(got - expected) > expected * 0.15 + 50_000,
    ),
  )
}
