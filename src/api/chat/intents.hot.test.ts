import { describe, expect, it } from 'vitest'
import { detectIntent } from '@/api/chat/intents'
import { containsWholePhrase, normalizeText, wordSimilarity } from '@/api/chat/match'

describe('chat intent: hot vs complaint', () => {
  it('does not treat short substrings as similar', () => {
    expect(wordSimilarity('co', 'complaint')).toBeLessThan(0.72)
    expect(wordSimilarity('hot', 'hotline')).toBeLessThan(0.72)
    expect(wordSimilarity('gi', 'giam')).toBeLessThan(0.72)
  })

  it('matches hot as whole word only', () => {
    expect(containsWholePhrase(normalizeText('goi hotline'), 'hot')).toBe(false)
    expect(containsWholePhrase(normalizeText('co mon do gi hot'), 'hot')).toBe(true)
  })

  it('maps "có món đồ gì hot" to recommend', () => {
    const hit = detectIntent('có món đồ gì hot', 'customer')
    expect(hit?.intent).toBe('recommend')
  })

  it('maps hotline to contact_escalate', () => {
    const hit = detectIntent('goi hotline cskh', 'customer')
    expect(hit?.intent).toBe('contact_escalate')
  })

  it('still maps khieu nai to complaint', () => {
    const hit = detectIntent('toi muon khieu nai', 'customer')
    expect(hit?.intent).toBe('complaint')
  })

  it('maps ban chay for customer to recommend', () => {
    const hit = detectIntent('san pham ban chay', 'customer')
    expect(hit?.intent).toBe('recommend')
  })
})
