import { containsWholePhrase, normalizeText } from '@/api/chat/match'

/** Từ đồng nghĩa / alias SP & danh mục VI (V31) + EN
 *  Tránh alias quá ngắn/chung (co, ao, bluetooth, ca…) — dễ kích hoạt nhầm khi hỏi giá. */
const SYNONYM_GROUPS: string[][] = [
  // Sản phẩm phổ biến
  ['tai nghe', 'headphone', 'headset', 'earphone', 'earbuds', 'tai nghe bluetooth'],
  ['ban phim', 'keyboard', 'keypro', 'ban phim co'],
  ['chuot', 'mouse', 'chuot khong day'],
  ['giay', 'sneaker', 'running', 'marathon', 'airflex', 'giay dep'],
  ['noi chien', 'air fryer', 'chien khong dau'],
  ['dien thoai', 'phone', 'smartphone', 'mobile'],
  // Brand riêng — không gộp macbook vào mọi laptop (tránh dump Dell/HP khi hỏi MacBook)
  ['laptop', 'may tinh xach tay', 'notebook'],
  ['macbook', 'mac book', 'mba', 'mbp', 'macbook air', 'macbook pro'],
  ['iphone', 'apple phone'],
  ['airpod', 'airpods', 'air pods'],
  // Use-case: lập trình / học IT
  ['laptop', 'lap trinh', 'programming', 'coding', 'developer', 'coder', 'sinh vien it', 'hoc code', 'vscode'],
  ['may tinh bang', 'tablet', 'ipad'],
  ['cham soc da', 'skincare', 'serum', 'kem duong'],
  ['trang diem', 'makeup'],
  // Danh mục marketplace VI
  ['dien thoai', 'phones', 'smartphones'],
  ['phu kien', 'accessory', 'accessories', 'op lung'],
  ['thoi trang nam', 'men fashion', 'ao nam', 'quan nam'],
  ['thoi trang nu', 'women fashion', 'ao nu', 'quan nu'],
  ['thoi trang', 'fashion'],
  ['nha bep', 'kitchen', 'gia dung bep', 'do bep'],
  ['noi that', 'furniture', 'noi that nha'],
  ['trang tri', 'decor', 'home decor'],
  ['thiet bi the hinh', 'fitness gear', 'gym', 'the hinh'],
  ['do da ngoai', 'outdoor', 'camping', 'da ngoai'],
  ['the thao', 'sport', 'fitness'],
  ['gia dung', 'nha cua', 'do gia dung', 'gia dung nha bep'],
  ['dien tu', 'electronics'],
  ['sach', 'book', 'books'],
  ['kinh', 'mat kinh', 'glasses', 'eyewear', 'kinh mat', 'kinh can', 'kinh mat thoi trang'],
  ['ao', 'ao thun', 'shirt', 'tshirt', 'tee'],
  ['quan', 'quan jean', 'pants', 'trousers'],
  ['balo', 'backpack', 'tui deo', 'tui xach'],
  ['dong ho', 'watch', 'smartwatch'],
  ['op lung', 'phone case', 'case dien thoai'],
  ['may loc nuoc', 'water purifier', 'loc nuoc'],
  ['am thuc', 'do an', 'food', 'snack'],
]

const ALIAS_LOOKUP = new Map<string, string[]>()

for (const group of SYNONYM_GROUPS) {
  const normalized = group.map((g) => normalizeText(g))
  for (const term of normalized) {
    const others = normalized.filter((x) => x !== term)
    ALIAS_LOOKUP.set(term, [...new Set([...(ALIAS_LOOKUP.get(term) ?? []), ...others])])
  }
}

/** Alias có xuất hiện đúng cụm/từ trong câu — không dùng substring ("ca"⊂"camping", "gia"⊂"giay") */
function queryHitsAlias(
  normalizedQuery: string,
  words: string[],
  alias: string,
  minWordLen = 4,
): boolean {
  if (!alias || alias.length < 2) return false
  if (containsWholePhrase(normalizedQuery, alias)) return true
  if (!alias.includes(' ') && alias.length >= minWordLen) {
    return words.some((w) => w === alias || (alias.length >= 4 && w.includes(alias)))
  }
  return false
}

/** Mở rộng từ khóa truy vấn bằng synonym */
export function expandQueryTerms(query: string, opts?: { search?: boolean }): string[] {
  const n = normalizeText(query)
  const words = n.split(/\s+/).filter((w) => w.length > 1)
  const out = new Set<string>(words)
  const minAliasLen = opts?.search ? 3 : 4

  for (const [alias, related] of ALIAS_LOOKUP) {
    if (!queryHitsAlias(n, words, alias, opts?.search ? minAliasLen : 4)) continue
    out.add(alias)
    for (const r of related) {
      out.add(r)
      for (const part of r.split(/\s+/)) {
        if (part.length >= (opts?.search ? 3 : 4)) out.add(part)
      }
    }
  }

  const skipBigram = new Set(['gia', 'ca', 'trung', 'binh', 'tb', 'avg', 'average', 'gia ca'])
  for (let i = 0; i < words.length - 1; i++) {
    if (skipBigram.has(words[i]) || skipBigram.has(words[i + 1])) continue
    out.add(`${words[i]} ${words[i + 1]}`)
  }
  if (words.length >= 3) {
    out.add(words.slice(0, 3).join(' '))
  }

  return [...out]
}

export function categoryAliases(categoryName: string): string[] {
  const n = normalizeText(categoryName)
  return [n, ...(ALIAS_LOOKUP.get(n) ?? [])]
}

const CATEGORY_QUESTION_SUFFIX =
  /\b(?:co\s+gi(?:\s+vay)?|co\s+nhung\s+gi|co\s+khong|ban\s+gi|co\s+mon\s+gi|co\s+sp\s+gi|co\s+san\s+pham\s+gi|dang\s+ban\s+gi)\s*$/

/** Bỏ khung hỏi "có gì / bán gì" để khớp tên danh mục chuẩn hơn */
export function stripCategoryBrowseQuery(raw: string): string {
  return normalizeText(raw)
    .replace(/^(?:cho\s+(?:minh|toi|em)\s+)?(?:xem|tim|goi\s+y|muon\s+xem)\s+/i, '')
    .replace(/^(?:do|hang|mon)\s+/i, '')
    .replace(CATEGORY_QUESTION_SUFFIX, '')
    .replace(/\?+$/, '')
    .trim()
}

function scoreCategoryMatch(
  query: string,
  c: { name: string; slug: string },
): number {
  if (!query) return 0
  const cn = normalizeText(c.name)
  const slug = normalizeText(c.slug.replace(/-/g, ' '))
  const aliases = categoryAliases(c.name)
  let score = 0
  if (query === cn || query === slug) score += 14
  if (cn.length > 2 && query.includes(cn)) score += 10
  if (slug && query.includes(slug)) score += 8
  for (const a of aliases) {
    if (a.length > 2 && (query === a || query.includes(a))) score += 6
  }
  for (const w of cn.split(/\s+/)) {
    if (w.length > 3 && query.includes(w)) score += 3
  }
  return score
}

/** Khớp tên danh mục API với câu hỏi (tên VI / slug / alias) */
export function matchCategoryFromText(
  raw: string,
  categories: { name: string; slug: string }[],
): { name: string; slug: string } | null {
  const n = normalizeText(raw)
  const stripped = stripCategoryBrowseQuery(raw)
  const queries = [...new Set([n, stripped].filter(Boolean))]
  let best: { name: string; slug: string; score: number } | null = null

  for (const c of categories) {
    for (const query of queries) {
      const score = scoreCategoryMatch(query, c)
      if (score > 0 && (!best || score > best.score)) {
        best = { name: c.name, slug: c.slug, score }
      }
    }
  }

  if (!best) return null
  if (best.score >= 6) return { name: best.name, slug: best.slug }
  return best.score >= 3 ? { name: best.name, slug: best.slug } : null
}
