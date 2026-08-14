import { describe, expect, it } from 'vitest'
import { quickPromptsForRole } from '@/api/chat/prompts'
import {
  buildProcessingLocale,
  isMetaShoppingQuestion,
  isShopCatalogQuestion,
  prepareCatalogSearchQuery,
  stripTrailingFillers,
  toEnglishProcessingText,
} from '@/api/chat/chatLocale'
import { normalizeText } from '@/api/chat/match'
import { detectIntent } from '@/api/chat/intents'
import { extractProductSearchTerms } from '@/api/chat/products'
import type { UserRole } from '@/types'

const FILLER_SUFFIXES = [' vậy?', ' nhỉ?', ' thế?', ' hả?', ' không?', ' à?', ' nha?']

describe('chatLocale fillers & homophones', () => {
  it('strips trailing vay without breaking ban gi', () => {
    expect(stripTrailingFillers(normalizeText('Web bán gì vậy?'))).toBe('web ban gi')
    expect(stripTrailingFillers(normalizeText('shop bán gì nhỉ'))).toBe('shop ban gi')
  })

  it('maps web/shop ban gi variants to catalog EN gloss', () => {
    for (const q of [
      'Web bán gì vậy?',
      'shop bán gì nhỉ',
      'website bán gì',
      'cửa hàng bán gì',
      'SEDSP bán gì',
    ]) {
      expect(toEnglishProcessingText(q)).toBe('what does the website sell')
      expect(isShopCatalogQuestion(normalizeText(q))).toBe(true)
      expect(extractProductSearchTerms(q)).toBe('')
    }
  })

  it('generic co X gi maps to English and detects intent', () => {
    const cases: Array<{ q: string; en: RegExp; intent: string }> = [
      { q: 'Có tai nghe gì?', en: /tai nghe|headphones/, intent: 'product_search' },
      { q: 'Điện thoại có gì?', en: /phone|dien thoai/, intent: 'category_browse' },
      { q: 'Có laptop gì vậy?', en: /laptop/, intent: 'product_search' },
      { q: 'Máy tính bảng có gì?', en: /tablet|may tinh bang/, intent: 'category_browse' },
      { q: 'Đồ gia dụng có gì?', en: /gia dung/, intent: 'category_browse' },
    ]
    for (const { q, en, intent } of cases) {
      expect(toEnglishProcessingText(q)).toMatch(en)
      expect(detectIntent(q, 'customer')?.intent).toBe(intent)
      expect(extractProductSearchTerms(q)).not.toMatch(/\bvay\b/)
    }
  })

  it('budget and discovery queries map correctly', () => {
    expect(toEnglishProcessingText('Có gì dưới 2 triệu không?')).toMatch(/budget/)
    expect(detectIntent('Có gì dưới 2 triệu không?', 'customer')?.intent).toBe('product_budget')
    expect(detectIntent('có gì hay', 'customer')?.intent).toBe('recommend')
    expect(detectIntent('có món gì mới không', 'customer')?.intent).toBe('recommend')
  })

  it('cheapest and seller queries', () => {
    expect(detectIntent('Sản phẩm nào rẻ nhất?', 'customer')?.intent).toBe('product_cheapest')
    expect(detectIntent('Doanh thu tháng này thế nào?', 'seller')?.intent).toBe('seller_revenue')
    expect(detectIntent('What if giảm giá 10% thì sao?', 'seller')?.intent).toBe('seller_whatif')
  })

  it('meta questions do not produce vay/skirt search terms', () => {
    expect(isMetaShoppingQuestion('web ban gi vay')).toBe(true)
    expect(prepareCatalogSearchQuery('Web bán gì vậy?')).toBe('')
  })

  it('category browse "X có gì" strips co gi frame from search terms', () => {
    expect(prepareCatalogSearchQuery('Điện thoại có gì?')).toBe('dien thoai')
    expect(prepareCatalogSearchQuery('Có tai nghe gì?')).toBe('tai nghe')
  })
})

describe('quick prompt coverage', () => {
  const roles: UserRole[] = ['guest', 'customer', 'seller', 'manager', 'admin']

  for (const role of roles) {
    it(`detectIntent works for all ${role} quick prompts`, () => {
      for (const p of quickPromptsForRole(role)) {
        for (const suffix of ['', ...FILLER_SUFFIXES.slice(0, 2)]) {
          const q = `${p.text.replace(/\?$/, '')}${suffix}`.trim()
          const hit = detectIntent(q, role)
          expect(hit?.intent, `no intent for [${role}] "${q}"`).toBeTruthy()
          if (isShopCatalogQuestion(buildProcessingLocale(q).normalized)) {
            expect(extractProductSearchTerms(q)).toBe('')
          }
        }
      }
    })
  }
})

describe('browse topic switch regression', () => {
  it('do gia dung is category browse not compare follow-up', () => {
    expect(detectIntent('đồ gia dụng', 'customer')?.intent).toBe('category_browse')
    expect(extractProductSearchTerms('đồ gia dụng')).not.toMatch(/vay/)
  })

  it('co gi vay alone is meta not skirt search', () => {
    expect(isMetaShoppingQuestion('co gi vay')).toBe(true)
    expect(prepareCatalogSearchQuery('có gì vậy')).toBe('')
  })
})
