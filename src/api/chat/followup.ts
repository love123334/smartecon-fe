import type { ChatMessage, ChatProductRef } from '@/types'

/** SP vừa được bàn trong hội thoại (card bot hoặc đính kèm user). */
export function lastDiscussedProducts(history: ChatMessage[]): ChatProductRef[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    if (m.products?.length) return m.products
    if (m.attachments?.length) return m.attachments
  }
  return []
}

/** Chủ đề rõ ràng không phải follow-up SP */
export function isClearTopicSwitch(normalized: string): boolean {
  return /(?:^|\s)(don hang|don cua|gio hang|thanh toan|dang nhap|dang ky|mat khau|khuyen mai|flash sale|danh muc|web ban gi|ban gi vay|sedsp la gi|lien he|khieu nai|doi tra|bao hanh|doanh thu|du bao nhu cau|what\s*if)(?:\s|$)/.test(
    normalized,
  )
}

/**
 * Câu follow-up về thuộc tính SP (không nhắc lại tên) —
 * cần gắn lại context sản phẩm vừa nói.
 */
export function isProductFollowUp(normalized: string): boolean {
  if (!normalized || normalized.length > 80) return false

  if (
    /cong dung|dung lam|dung de|mo ta|tinh nang|dac diem|gioi thieu|what (is|does)|ve no|ve cai nay|san pham nay|sp nay|cai nay|no the nao|dung nhu the nao|cho minh biet|chat luong|nghe duoc|pin tru|mau sac|size|kich thuoc|bao nhieu tien|gia bao nhieu|con hang|het hang|con khong|tot khong|review|danh gia/.test(
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
    return /^(la gi|gia bao nhieu|bao nhieu tien|con hang khong|het hang chua|tot khong|nhu the nao|the nao|con bao nhieu|sao vay|the nao vay)$/.test(
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
  if (isProductFollowUp(normalized)) return true
  if (isClearTopicSwitch(normalized)) return false
  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length > 8) return false
  // Đại từ / hỏi thêm ngắn
  return /^(no|cai do|cai nay|sp nay|hang nay|tiep|them|chi tiet|giai thich|noi them|con gi|sao|the nao)/.test(
    normalized,
  ) || (words.length <= 4 && /^(ok|oke|uhm|vay|vay a|vay ha|duoc|roi)$/.test(normalized) === false && /gia|hang|sp|san pham|mua|dung|tot|con|het|bao|nhu|the/.test(normalized))
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
    )
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
