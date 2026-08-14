import { normalizeChatTypos, normalizeText } from '@/api/chat/match'
import { normalizeUserQuery, stripTrailingFillers } from '@/api/chat/chatLocale'

/** Chuẩn hóa câu khám phá SP — bỏ dấu, typo chat, slang TMĐT. */
export function normalizeDiscoveryText(raw: string): string {
  let n = normalizeChatTypos(normalizeUserQuery(raw))
  n = n
    .replace(/\bxiin\b|\bxijn\b|\bxij\b|\bxin xo\b|\bxin so\b/g, 'xin')
    .replace(/\bngonn\b|\bngonnn\b/g, 'ngon')
    .replace(/\bhayy\b|\bhay ho\b/g, 'hay')
    .replace(/\bdinhh\b|\bdinh vay\b/g, 'dinh')
    .replace(/\bchat luong\b/g, 'chat')
    .replace(/\bre vay\b|\bre do\b/g, 're')
  return n.trim()
}

/** Tính từ / slang mua sắm: "có gì hay/xịn/ngon…" */
const INFORMAL_BROWSE_ADJ =
  'hay|xin|ngon|tot|dinh|chat|on|dep|re|xinh|dang mua|dang xem|dang ban|dang hot|noi bat|dang giam'

/** Câu hỏi khám phá SP — in-domain, không phải off-topic. */
export function asksProductDiscovery(rawOrNormalized: string): boolean {
  const n = normalizeDiscoveryText(rawOrNormalized)
  if (!n) return false
  return (
    /co mon gi moi|co gi moi|co hang moi|co san pham moi|mon moi|hang moi|sp moi|san pham moi|moi len ke|moi nhap|moi ve|moi hang|new arrival|what.?s new/.test(
      n,
    ) ||
    /co gi dang mua|co gi dang xem|co gi tot|co gi ngon|co gi dang|dang co gi|co gi do|dang mua khong/.test(
      n,
    ) ||
    new RegExp(`co gi (?:${INFORMAL_BROWSE_ADJ})(?:\\s+khong|\\s+do|\\s+vay)?(?:\\s|$)`).test(n) ||
    new RegExp(`(?:^|\\s)(?:co|shop co) (?:mon|hang|sp|san pham) gi (?:${INFORMAL_BROWSE_ADJ})`).test(
      n,
    ) ||
    /co gi hay khong|co gi hay do|co gi hay vay|co gi xin khong|co gi ngon khong/.test(n) ||
    /gioi thieu.*mon|goi y.*mon|gioi thieu.*sp|goi y.*sp|co gi dang ban|co ban gi moi|shop co gi moi/.test(
      n,
    ) ||
    /co mon nao|co sp nao|co san pham nao|tim mon moi|xem mon moi/.test(n) ||
    /co gi dang giam|deal dang|dang sale|san pham noi bat/.test(n) ||
    /co gi dang mua khong|co gi dang hot|co mon dang|dang co mon/.test(n) ||
    /goi y gi|goi y cho|nen mua gi|mua gi cho|co gi dang mua|co gi dang xem thu/.test(n)
  )
}

/** Câu mới về tìm / duyệt SP — không gắn SP cũ trong hội thoại. */
export function isStandaloneShoppingQuery(rawOrNormalized: string): boolean {
  const n = normalizeDiscoveryText(rawOrNormalized)
  if (!n) return false
  if (asksProductDiscovery(n)) return true
  if (/^co\s+[a-z0-9\s]{2,28}\s+gi(?:\s|$)/.test(n) && !/co gi (?:hay|xin|ngon|tot|dinh|moi)/.test(n) && !/(?:^|\s)(?:hot|moi|ban chay|dang hot)(?:\s|$)/.test(n)) {
    return true
  }
  if (
    /^(?:do|hang|mon|san pham)\s+(?:gia dung|do gia dung|dien tu|thoi trang|the thao|nha bep|noi that|cham soc da|trang diem|do da ngoai|may tinh bang|tai nghe|laptop|dien thoai|giay|phu kien)/.test(
      n,
    )
  ) {
    return true
  }
  if (
    /^(?:gia dung|do gia dung|dien tu|thoi trang nam|thoi trang nu|may tinh bang|tai nghe|laptop|dien thoai|giay dep|phu kien|nha bep|noi that|cham soc da|trang diem|do da ngoai)(?:\s|$)/.test(
      n,
    )
  ) {
    return true
  }
  if (
    /(?:duoi|tren|tu)\s+\d|trieu|\d+\s*tr\b|\d+\s*cu\b/.test(n) &&
    /tai nghe|laptop|may tinh bang|dien thoai|giay|tablet|ipad|macbook|iphone|noi chien|ao |quan |vay/.test(
      n,
    )
  ) {
    return true
  }
  return false
}

/** Câu quá mơ hồ — hỏi lại, không đoán SP (chỉ khi không có tính từ gợi ý). */
export function isAmbiguousShoppingQuery(rawOrNormalized: string): boolean {
  const n = normalizeDiscoveryText(rawOrNormalized)
  if (asksProductDiscovery(n)) return false
  if (/^web ban gi|^ban gi(?:\s|$)/.test(n)) return false
  return /^(co gi do|co gi vay|co gi khong|co gi|hay khong|tot khong)$/.test(n)
}

export function isDiscoveryNewestQuery(rawOrNormalized: string): boolean {
  const n = normalizeDiscoveryText(rawOrNormalized)
  return /moi|new|moi len|moi nhap|moi ve|hang moi|mon moi/.test(n) && asksProductDiscovery(n)
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
