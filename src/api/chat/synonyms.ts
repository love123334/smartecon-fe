import { normalizeText } from '@/api/chat/match'

/** Từ đồng nghĩa / alias SP & danh mục — fuzzy tiếng Việt & Anh */
const SYNONYM_GROUPS: string[][] = [
  ['tai nghe', 'headphone', 'headset', 'earphone', 'earbuds', 'airpod', 'bluetooth'],
  ['ban phim', 'keyboard', 'keypro', 'co'],
  ['chuot', 'mouse', 'chuot khong day'],
  ['giay', 'sneaker', 'running', 'marathon', 'airflex'],
  ['noi chien', 'air fryer', 'chien khong dau', 'noi'],
  ['dien tu', 'electronics', 'tech', 'cong nghe'],
  ['the thao', 'sport', 'fitness'],
  ['gia dung', 'home', 'nha cua', 'bep'],
  ['thoi trang', 'fashion', 'ao', 'quan'],
  ['sach', 'book', 'books'],
  ['phu kien', 'accessory', 'accessories'],
]

const ALIAS_LOOKUP = new Map<string, string[]>()

for (const group of SYNONYM_GROUPS) {
  const normalized = group.map((g) => normalizeText(g))
  for (const term of normalized) {
    const others = normalized.filter((x) => x !== term)
    ALIAS_LOOKUP.set(term, [...new Set([...(ALIAS_LOOKUP.get(term) ?? []), ...others])])
  }
}

/** Mở rộng từ khóa truy vấn bằng synonym */
export function expandQueryTerms(query: string): string[] {
  const n = normalizeText(query)
  const words = n.split(/\s+/).filter((w) => w.length > 1)
  const out = new Set<string>(words)

  for (const [alias, related] of ALIAS_LOOKUP) {
    if (n.includes(alias) || words.some((w: string) => alias.includes(w) || w.includes(alias))) {
      out.add(alias)
      for (const r of related) {
        for (const part of r.split(/\s+/)) {
          if (part.length > 2) out.add(part)
        }
        out.add(r)
      }
    }
  }

  // bigrams từ câu hỏi gốc
  for (let i = 0; i < words.length - 1; i++) {
    out.add(`${words[i]} ${words[i + 1]}`)
  }

  return [...out]
}

export function categoryAliases(categoryName: string): string[] {
  const n = normalizeText(categoryName)
  return [n, ...(ALIAS_LOOKUP.get(n) ?? [])]
}
