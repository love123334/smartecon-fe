import { describe, expect, it } from 'vitest'
import {
  buildProcessingLocale,
  isShopCatalogQuestion,
  stripTrailingFillers,
  toEnglishProcessingText,
} from '@/api/chat/chatLocale'
import { normalizeText } from '@/api/chat/match'
import { detectIntent } from '@/api/chat/intents'
import { extractProductSearchTerms } from '@/api/chat/products'

describe('chatLocale', () => {
  it('strips trailing vay filler without breaking ban gi', () => {
    expect(stripTrailingFillers(normalizeText('Web bán gì vậy?'))).toBe('web ban gi')
  })

  it('maps web ban gi to English catalog question', () => {
    expect(toEnglishProcessingText('Web bán gì vậy?')).toBe('what does the website sell')
    expect(isShopCatalogQuestion(normalizeText('web ban gi'))).toBe(true)
  })

  it('detectIntent shop_overview for web ban gi vay', () => {
    const hit = detectIntent('Web bán gì vậy?', 'guest')
    expect(hit?.intent).toBe('shop_overview')
  })

  it('does not extract vay as product search term', () => {
    const terms = extractProductSearchTerms('Web bán gì vậy?')
    expect(terms).toBe('')
  })

  it('maps co tai nghe gi to English', () => {
    const locale = buildProcessingLocale('Có tai nghe gì?')
    expect(locale.english).toBe('what headphones are available')
  })
})
