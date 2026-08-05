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

/**
 * Câu follow-up về thuộc tính SP (không nhắc lại tên) —
 * cần gắn lại context sản phẩm vừa nói.
 */
export function isProductFollowUp(normalized: string): boolean {
  if (!normalized || normalized.length > 72) return false

  if (
    /cong dung|dung lam|dung de|mo ta|tinh nang|dac diem|gioi thieu|what (is|does)|ve no|ve cai nay|san pham nay|sp nay|cai nay|no the nao|dung nhu the nao|cho minh biet/.test(
      normalized,
    )
  ) {
    return true
  }

  if (
    /^(gia|bao nhieu|con hang|het hang|con khong|tot khong|review|danh gia|so sanh|compare)(\b|$)/.test(
      normalized,
    )
  ) {
    return true
  }

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length <= 5) {
    return /^(la gi|gia bao nhieu|bao nhieu tien|con hang khong|het hang chua|tot khong|nhu the nao|the nao|con bao nhieu)$/.test(
      normalized,
    )
  }

  return false
}
