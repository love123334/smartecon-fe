import { normalizeText } from '@/api/chat/match'

/** Câu hỏi khám phá SP — in-domain, không phải off-topic. */
export function asksProductDiscovery(normalized: string): boolean {
  const n = normalized.trim()
  if (!n) return false
  return (
    /co mon gi moi|co gi moi|co hang moi|co san pham moi|mon moi|hang moi|sp moi|san pham moi|moi len ke|moi nhap|moi ve|moi hang|new arrival|what.?s new/.test(
      n,
    ) ||
    /co gi dang mua|co gi dang xem|co gi tot|co gi ngon|co gi dang|dang co gi|co gi do|dang mua khong/.test(n) ||
    /co gi hay khong|co gi hay do|co gi hay vay/.test(n) ||
    /gioi thieu.*mon|goi y.*mon|gioi thieu.*sp|goi y.*sp|co gi dang ban|co ban gi moi|shop co gi moi/.test(n) ||
    /co mon nao|co sp nao|co san pham nao|tim mon moi|xem mon moi/.test(n) ||
    /co gi dang giam|deal dang|dang sale|san pham noi bat/.test(n) ||
    /co gi dang mua khong|co gi dang hot|co mon dang|dang co mon/.test(n)
  )
}

/** Câu quá mơ hồ — cần hỏi lại, không đoán SP. */
export function isAmbiguousShoppingQuery(normalized: string): boolean {
  const n = normalized.trim()
  if (asksProductDiscovery(n)) return false
  return /^(co gi hay|co gi tot|co gi ngon|co gi do|co gi vay|co gi khong|co gi|hay khong|tot khong)$/.test(n)
}

export function isDiscoveryNewestQuery(normalized: string): boolean {
  return /moi|new|moi len|moi nhap|moi ve|hang moi|mon moi/.test(normalized) && asksProductDiscovery(normalized)
}

export function isUnknownEscalateText(content: string): boolean {
  return /chua hieu ro cau hoi nay trong pham vi mua sam sedsp/.test(
    normalizeText(content),
  )
}

export function discoveryReplyIntro(
  userName: string | undefined,
  count: number,
  mode: 'newest' | 'recommend' | 'clarify',
): string {
  const greet =
    userName?.trim() && userName.length >= 2 && !/guest|khach hang/i.test(userName)
      ? `${userName.trim().split(/\s+/).pop()}, `
      : ''
  if (mode === 'clarify') {
    return `${greet}Bạn muốn xem **sản phẩm mới**, **deal đang giảm**, hay **đồ được đánh giá cao**? Nói rõ thêm một chút để tui lọc cho đúng nhé.`
  }
  if (mode === 'newest') {
    if (count <= 0) {
      return `${greet}Hiện chưa thấy sản phẩm mới nổi bật — thử mở **Cửa hàng** hoặc hỏi theo danh mục (laptop, thời trang…).`
    }
    return `${greet}Có chứ — tui tìm **${count}** món mới / đáng xem trên SEDSP cho bạn nè 👀`
  }
  if (count <= 0) {
    return `${greet}Chưa có gợi ý phù hợp — thử **Cửa hàng** hoặc hỏi theo ngân sách / danh mục nhé.`
  }
  return `${greet}Tui gom **${count}** gợi ý trên shop — xem thử bên dưới nhé.`
}
