import { normalizeText } from '@/api/chat/match'

/** Từ đồng nghĩa / alias SP & danh mục VI (V31) + EN */
const SYNONYM_GROUPS: string[][] = [
  // Sản phẩm phổ biến
  ['tai nghe', 'headphone', 'headset', 'earphone', 'earbuds', 'airpod', 'bluetooth'],
  ['ban phim', 'keyboard', 'keypro', 'co'],
  ['chuot', 'mouse', 'chuot khong day'],
  ['giay', 'sneaker', 'running', 'marathon', 'airflex', 'giay dep'],
  ['noi chien', 'air fryer', 'chien khong dau', 'noi'],
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
  ['trang diem', 'makeup', 'son', 'phan'],
  // Danh mục marketplace VI
  ['dien thoai', 'phones', 'smartphones'],
  ['phu kien', 'accessory', 'accessories', 'op lung', 'sac'],
  ['thoi trang nam', 'men fashion', 'ao nam', 'quan nam'],
  ['thoi trang nu', 'women fashion', 'ao nu', 'quan nu'],
  ['thoi trang', 'fashion', 'ao', 'quan'],
  ['nha bep', 'kitchen', 'gia dung bep', 'do bep'],
  ['noi that', 'furniture', 'noi that nha'],
  ['trang tri', 'decor', 'home decor'],
  ['thiet bi the hinh', 'fitness gear', 'gym', 'the hinh'],
  ['do da ngoai', 'outdoor', 'camping', 'da ngoai'],
  ['the thao', 'sport', 'fitness'],
  ['gia dung', 'home', 'nha cua', 'bep'],
  ['dien tu', 'electronics', 'tech', 'cong nghe'],
  ['sach', 'book', 'books'],
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

/** Khớp tên danh mục API với câu hỏi (tên VI / slug / alias) */
export function matchCategoryFromText(
  raw: string,
  categories: { name: string; slug: string }[],
): { name: string; slug: string } | null {
  const n = normalizeText(raw)
  let best: { name: string; slug: string; score: number } | null = null

  for (const c of categories) {
    const cn = normalizeText(c.name)
    const slug = normalizeText(c.slug.replace(/-/g, ' '))
    const aliases = categoryAliases(c.name)
    let score = 0
    if (n.includes(cn) || cn.length > 3 && n.includes(cn)) score += 10
    if (slug && n.includes(slug)) score += 8
    for (const a of aliases) {
      if (a.length > 2 && n.includes(a)) score += 6
    }
    // từng từ danh mục (vd: "dien thoai", "thoi trang nam")
    for (const w of cn.split(/\s+/)) {
      if (w.length > 3 && n.includes(w)) score += 3
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { name: c.name, slug: c.slug, score }
    }
  }

  return best && best.score >= 3 ? { name: best.name, slug: best.slug } : null
}
