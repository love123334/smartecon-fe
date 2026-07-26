export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
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
  if (a.includes(b) || b.includes(a)) return 0.92
  const dist = levenshtein(a, b)
  return 1 - dist / Math.max(a.length, b.length)
}

/** Boost nếu cụm từ (phrase) xuất hiện nguyên trong câu */
export function phraseBoost(normalizedText: string, phrases: string[]): number {
  let boost = 0
  for (const p of phrases) {
    const np = normalizeText(p)
    if (np.length >= 3 && normalizedText.includes(np)) {
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
    if (normalizedText.includes(nk)) {
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
      if (normalizedText.includes(part)) {
        local = part.length * 1.4
        matched++
      } else {
        for (const tw of textWords) {
          const sim = wordSimilarity(tw, part)
          if (sim >= 0.72) {
            local = Math.max(local, sim * part.length)
            matched++
            break
          }
        }
      }
      partScore += local
    }
    if (matched / parts.length >= 0.55) {
      best = Math.max(best, partScore)
    }
  }
  return best
}

export function fuzzyMatchText(normalizedText: string, keyword: string, minSim = 0.68): boolean {
  const nk = normalizeText(keyword)
  if (!nk) return false
  if (normalizedText.includes(nk)) return true

  const kwParts = nk.split(/\s+/).filter((p: string) => p.length > 2)
  if (!kwParts.length) return false

  const textWords = normalizedText.split(/\s+/).filter((w: string) => w.length > 1)
  let matchedParts = 0
  for (const part of kwParts) {
    if (normalizedText.includes(part)) {
      matchedParts++
      continue
    }
    for (const tw of textWords) {
      if (wordSimilarity(tw, part) >= minSim) {
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
