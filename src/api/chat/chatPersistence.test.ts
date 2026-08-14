import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  activateSavedSession,
  closeLoginSession,
  ensureActiveSession,
  listSavedSessions,
  saveActiveSessionTurn,
  startLoginSession,
  startNewChatInLogin,
} from '@/api/chat/chatPersistence'
import { emptyConversationContext } from '@/api/chat/conversationContext'

const USER = 'u-test-1'

function installLocalStorageMock() {
  const store = new Map<string, string>()
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
  }
  vi.stubGlobal('localStorage', mock)
  return mock
}

beforeEach(() => {
  installLocalStorageMock()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chatPersistence', () => {
  it('creates a new session on each login', () => {
    const s1 = startLoginSession(USER, 'customer')
    saveActiveSessionTurn(
      USER,
      [{ id: '1', role: 'user', content: 'xin chao', timestamp: new Date().toISOString() }],
      emptyConversationContext(),
    )
    closeLoginSession(USER)
    const s2 = startLoginSession(USER, 'customer')
    expect(s2.id).not.toBe(s1.id)
    expect(ensureActiveSession(USER, 'customer').messages).toEqual([])
  })

  it('lists and reopens saved sessions', () => {
    const s1 = startLoginSession(USER, 'customer')
    saveActiveSessionTurn(
      USER,
      [{ id: '1', role: 'user', content: 'tai nghe duoi 2 trieu', timestamp: new Date().toISOString() }],
      emptyConversationContext(),
    )
    startNewChatInLogin(USER, 'customer')
    const past = listSavedSessions(USER)
    expect(past.some((s) => s.id === s1.id)).toBe(true)
    const reopened = activateSavedSession(USER, s1.id)
    expect(reopened?.messages[0]?.content).toContain('tai nghe')
  })
})
