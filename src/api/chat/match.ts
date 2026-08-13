export function formatVnd(amount: number): string {
  // Compact: tránh "₫" / khoảng trắng hẹp làm đội khung card hẹp
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))}đ`
}

/** Bỏ dấu + lowercase — dùng cho fuzzy match tiếng Việt/Anh */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^\w\s@.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Khớp token trong field — từ ngắn (≤4) bắt buộc whole-word
 * (tránh "ao" ⊂ "thoai", "co" ⊂ "complaint").
 */
export function fieldContainsToken(field: string, token: string): boolean {
  if (!field || !token) return false
  const f = normalizeText(field)
  const t = normalizeText(token)
  if (!t) return false
  if (t.includes(' ')) return containsWholePhrase(f, t)
  if (t.length <= 4) return containsWholePhrase(f, t)
  return f.includes(t) || containsWholePhrase(f, t)
}

/** Khớp cụm theo ranh giới từ — tránh "hot" khớp trong "hotline" */
export function containsWholePhrase(normalizedText: string, phrase: string): boolean {
  const p = normalizeText(phrase)
  if (!p || !normalizedText) return false
  if (normalizedText === p) return true
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(normalizedText)
}

/** Levenshtein distance — hỗ trợ typo / thiếu dấu gần đúng */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const val =
        a[i - 1] === b[j - 1]
          ? row[j - 1]
          : Math.min(row[j - 1], row[j], prev) + 1
      row[j - 1] = prev
      prev = val
    }
    row[b.length] = prev
  }
  return row[b.length]
}

export function wordSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  // Substring chỉ tính khi từ ngắn đủ dài — tránh "co"⊂"complaint", "hot"⊂"hotline"
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return 0.92
  }
  const dist = levenshtein(a, b)
  return 1 - dist / Math.max(a.length, b.length)
}

/** Boost nếu cụm từ (phrase) xuất hiện nguyên trong câu */
export function phraseBoost(normalizedText: string, phrases: string[]): number {
  let boost = 0
  for (const p of phrases) {
    const np = normalizeText(p)
    if (np.length >= 3 && containsWholePhrase(normalizedText, np)) {
      boost = Math.max(boost, np.length * 2.5 + 20)
    }
  }
  return boost
}

/** Score keyword có ưu tiên cụm dài / khớp gần đúng tốt hơn */
export function scoreKeywords(normalizedText: string, keywords: string[]): number {
  let best = 0
  for (const kw of keywords) {
    const nk = normalizeText(kw)
    if (!nk) continue

    if (normalizedText === nk) {
      best = Math.max(best, nk.length + 40)
      continue
    }
    if (containsWholePhrase(normalizedText, nk)) {
      best = Math.max(best, nk.length + 18 + Math.min(nk.split(/\s+/).length * 4, 16))
      continue
    }

    const parts = nk.split(/\s+/).filter((p: string) => p.length > 2)
    const textWords = normalizedText.split(/\s+/).filter((w: string) => w.length > 1)
    if (!parts.length) continue

    let partScore = 0
    let matched = 0
    for (const part of parts) {
      let local = 0
      if (containsWholePhrase(normalizedText, part)) {
        local = part.length * 1.4
        matched++
      } else if (part.length >= 4) {
        // Fuzzy chỉ cho từ ≥4 ký tự — tránh ung≈dung, co≈complaint
        for (const tw of textWords) {
          const sim = wordSimilarity(tw, part)
          if (sim >= 0.78) {
            local = Math.max(local, sim * part.length)
            matched++
            break
          }
        }
      }
      partScore += local
    }
    // Multi-word keywords must match all parts — otherwise "san pham nao re"
    // falsely scores on any sentence that only contains "san pham".
    const ratio = matched / parts.length
    const ok = parts.length >= 2 ? ratio >= 0.999 : ratio >= 0.55
    if (ok) {
      best = Math.max(best, partScore)
    }
  }
  return best
}

export function fuzzyMatchText(normalizedText: string, keyword: string, minSim = 0.68): boolean {
  const nk = normalizeText(keyword)
  if (!nk) return false
  if (containsWholePhrase(normalizedText, nk)) return true

  const kwParts = nk.split(/\s+/).filter((p: string) => p.length > 2)
  if (!kwParts.length) return false

  const textWords = normalizedText.split(/\s+/).filter((w: string) => w.length > 1)
  let matchedParts = 0
  for (const part of kwParts) {
    if (containsWholePhrase(normalizedText, part)) {
      matchedParts++
      continue
    }
    if (part.length < 4) continue
    for (const tw of textWords) {
      if (wordSimilarity(tw, part) >= Math.max(minSim, 0.78)) {
        matchedParts++
        break
      }
    }
  }
  return matchedParts >= Math.ceil(kwParts.length * 0.6)
}

export function matchAnyKeyword(
  normalizedText: string,
  keywords: string[],
  minSim = 0.68,
): boolean {
  return keywords.some((kw) => fuzzyMatchText(normalizedText, kw, minSim))
}

/** Câu rất ngắn kiểu chào */
export function isShortGreeting(normalized: string): boolean {
  return /^(xin chao|chao|hello|hi|hey|alo|yo|chao shop|chao ban)$/.test(normalized)
}

/** Chuẩn hóa typo chat phổ biến — "nghi seo" → "nghi sao". */
export function normalizeChatTypos(normalized: string): string {
  return normalized
    .replace(/\bnghi\s+seo\b/g, 'nghi sao')
    .replace(/\bthay\s+seo\b/g, 'thay sao')
    .replace(/\bnghi\s+the\b/g, 'nghi the nao')
    .replace(/\bsao\s+vay\b/g, 'sao')
}

/** Hỏi đánh giá / review — không nhầm với "giá" trong "đánh giá". */
export function asksProductReview(normalized: string): boolean {
  const n = normalizeChatTypos(normalized)
  if (
    /danh gia|review|rating|feedback|nhan xet|y kien khach|cam nhan|danh gia sao/.test(
      n,
    )
  ) {
    return true
  }
  if (
    /khach.*(danh gia|nhan xet|thay|noi|bao|cam nhan)|nguoi mua.*(danh gia|nhan xet|thay|noi)|mua roi.*(thay|danh gia|sao)/.test(
      n,
    )
  ) {
    return true
  }
  if (
    /(?:^|\s)(?:khach|nguoi mua|moi nguoi|nguoi ta)\s+(?:nghi|thay|noi|danh gia)\s+(?:sao|the nao|ra sao|on khong|tot khong|gi)(?:\s|$)/.test(
      n,
    )
  ) {
    return true
  }
  if (
    /(?:^|\s)(?:khach|nguoi mua|moi nguoi)\s+thay\s+(?:sao|the nao|ra sao|on khong|tot khong)(?:\s|$)/.test(
      n,
    )
  ) {
    return true
  }
  if (/nguoi ta nghi|moi nguoi nghi|nguoi ta thay|moi nguoi thay|nguoi dung nghi|khach hang nghi/.test(n)) {
    return true
  }
  if (/y kien.*(the nao|sao|ra sao)|noi gi ve|ai phan nan|phan nan gi|diem tru|khong hai long/.test(n)) {
    return true
  }
  if (/dang mua khong|co nen mua|nen mua khong|co tot khong|co on khong|on khong|tot khong|duoc khong|co duoc khong/.test(n)) {
    return true
  }
  if (/tot khong|chat luong|ngon khong|co tot khong|ok khong|co on khong/.test(n)) {
    return true
  }
  if (/(?:may|\d)\s*sao/.test(n)) return true
  return false
}

/** Hỏi giá — tránh khớp "gia" bên trong "danh gia". */
export function asksProductPrice(normalized: string): boolean {
  if (asksProductReview(normalized)) return false
  return (
    /(?:^|\s)(?:gia|price|cost)(?:\s|$)/.test(normalized) ||
    /gia\s+(?:bao nhieu|may|re|bn|khoang|minh|thap|cao|nguoi|ban)/.test(normalized) ||
    /bao nhieu|how much|may trieu|may cu|mấy triệu|mấy củ|tien/.test(normalized)
  )
}

export function asksProductOrigin(normalized: string): boolean {
  return /xuat xu|made in|hang nao|san xuat o|san xuat tai|nguon goc|origin|country|san xuat/.test(
    normalized,
  )
}

export function asksProductListedDate(normalized: string): boolean {
  return /ngay len ke|len ke|bao lau|khi nao len|ra mat tren|co tu khi nao|dang ban tu|len san|len ke khi nao/.test(
    normalized,
  )
}

/** Hỏi về shop / người bán — hiện danh thiếp seller */
export function asksSellerInfo(normalized: string): boolean {
  if (/web ban gi|sedsp ban gi|catalog|san co gi|toan san/.test(normalized)) return false
  return /lien he nguoi ban|contact seller|thong tin shop|thong tin nguoi ban|nguoi ban nay|shop nay|seller nay|nguoi ban la ai|shop la ai|email shop|sdt shop|so dien thoai shop|go shop|cua hang nay|nguoi ban cua|ve shop|ve nguoi ban|danh thiep|ai la nguoi ban|shop nay ban|nguoi ban sp nay/.test(
    normalized,
  )
}
