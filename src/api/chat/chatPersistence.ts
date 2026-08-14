import {
  emptyConversationContext,
  type ConversationContext,
} from '@/api/chat/conversationContext'
import { storageGet, storageSet, STORAGE_KEYS } from '@/api/storage'
import type { ChatMessage, UserRole } from '@/types'

const SESSIONS_KEY = 'chat_sessions_v2'
const MAX_SESSIONS_PER_USER = 30
const MAX_MESSAGES_PER_SESSION = 200

export interface ChatLoginSession {
  id: string
  userKey: string
  role: UserRole
  startedAt: string
  updatedAt: string
  title: string
  closedAt?: string
  messages: ChatMessage[]
  conversation: ConversationContext
}

interface UserChatSessions {
  activeSessionId: string | null
  sessions: ChatLoginSession[]
}

type SessionsMap = Record<string, UserChatSessions>

function newSessionId(): string {
  return `cs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function sessionTitleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.content.trim())
  if (!firstUser) return 'Cuộc trò chuyện mới'
  const t = firstUser.content.trim().replace(/\s+/g, ' ')
  return t.length > 48 ? `${t.slice(0, 48)}…` : t
}

function migrateLegacyIfNeeded(userKey: string, data: UserChatSessions): UserChatSessions {
  const legacy = storageGet<Record<string, ChatMessage[]>>(STORAGE_KEYS.chatHistory, {})
  const oldMessages = legacy[userKey]
  if (!oldMessages?.length) return data
  if (data.sessions.some((s) => s.messages.length > 0)) {
    delete legacy[userKey]
    storageSet(STORAGE_KEYS.chatHistory, legacy)
    return data
  }
  const session: ChatLoginSession = {
    id: newSessionId(),
    userKey,
    role: 'customer',
    startedAt: oldMessages[0]?.timestamp ?? new Date().toISOString(),
    updatedAt: oldMessages.at(-1)?.timestamp ?? new Date().toISOString(),
    title: sessionTitleFromMessages(oldMessages),
    messages: oldMessages.slice(-MAX_MESSAGES_PER_SESSION),
    conversation: emptyConversationContext(),
    closedAt: new Date().toISOString(),
  }
  delete legacy[userKey]
  storageSet(STORAGE_KEYS.chatHistory, legacy)
  return {
    activeSessionId: null,
    sessions: [session, ...data.sessions].slice(0, MAX_SESSIONS_PER_USER),
  }
}

function getUserData(userKey: string): UserChatSessions {
  const map = storageGet<SessionsMap>(SESSIONS_KEY, {})
  let data = map[userKey] ?? { activeSessionId: null, sessions: [] }
  data = migrateLegacyIfNeeded(userKey, data)
  map[userKey] = data
  storageSet(SESSIONS_KEY, map)
  return data
}

function saveUserData(userKey: string, data: UserChatSessions): void {
  const map = storageGet<SessionsMap>(SESSIONS_KEY, {})
  map[userKey] = data
  storageSet(SESSIONS_KEY, map)
}

function findSession(data: UserChatSessions, sessionId: string): ChatLoginSession | undefined {
  return data.sessions.find((s) => s.id === sessionId)
}

/** Mỗi lần đăng nhập = một phiên chat mới (giống ChatGPT). */
export function startLoginSession(userKey: string, role: UserRole): ChatLoginSession {
  const data = getUserData(userKey)
  if (data.activeSessionId) {
    const active = findSession(data, data.activeSessionId)
    if (active && !active.closedAt) active.closedAt = new Date().toISOString()
  }
  const session: ChatLoginSession = {
    id: newSessionId(),
    userKey,
    role,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Cuộc trò chuyện mới',
    messages: [],
    conversation: emptyConversationContext(),
  }
  data.sessions.unshift(session)
  data.activeSessionId = session.id
  if (data.sessions.length > MAX_SESSIONS_PER_USER) {
    data.sessions = data.sessions.slice(0, MAX_SESSIONS_PER_USER)
  }
  saveUserData(userKey, data)
  return session
}

export function getActiveSession(userKey: string): ChatLoginSession | null {
  const data = getUserData(userKey)
  if (!data.activeSessionId) return null
  const session = findSession(data, data.activeSessionId)
  if (!session || session.closedAt) return null
  return session
}

export function ensureActiveSession(userKey: string, role: UserRole): ChatLoginSession {
  return getActiveSession(userKey) ?? startLoginSession(userKey, role)
}

export function saveActiveSessionTurn(
  userKey: string,
  messages: ChatMessage[],
  conversation: ConversationContext,
): void {
  const data = getUserData(userKey)
  if (!data.activeSessionId) return
  const idx = data.sessions.findIndex((s) => s.id === data.activeSessionId)
  if (idx < 0) return
  const session = data.sessions[idx]
  session.messages = messages.slice(-MAX_MESSAGES_PER_SESSION)
  session.conversation = conversation
  session.updatedAt = new Date().toISOString()
  session.title = sessionTitleFromMessages(session.messages)
  data.sessions[idx] = session
  saveUserData(userKey, data)
}

export function closeLoginSession(userKey: string): void {
  const data = getUserData(userKey)
  if (data.activeSessionId) {
    const session = findSession(data, data.activeSessionId)
    if (session) session.closedAt = new Date().toISOString()
  }
  data.activeSessionId = null
  saveUserData(userKey, data)
}

/** Chat mới trong cùng phiên đăng nhập — đóng cuộc cũ, mở cuộc trống. */
export function startNewChatInLogin(userKey: string, role: UserRole): ChatLoginSession {
  const data = getUserData(userKey)
  if (data.activeSessionId) {
    const current = findSession(data, data.activeSessionId)
    if (current && !current.closedAt && current.messages.length === 0) {
      return current
    }
    if (current && !current.closedAt) current.closedAt = new Date().toISOString()
  }
  return startLoginSession(userKey, role)
}

export function listSavedSessions(userKey: string, includeActive = false): ChatLoginSession[] {
  const data = getUserData(userKey)
  return data.sessions.filter((session) => {
    if (!includeActive && session.id === data.activeSessionId && !session.closedAt) {
      return false
    }
    return session.messages.length > 0
  })
}

/** Mở lại cuộc chat đã lưu (trong cùng tài khoản). */
export function activateSavedSession(userKey: string, sessionId: string): ChatLoginSession | null {
  const data = getUserData(userKey)
  const target = findSession(data, sessionId)
  if (!target) return null
  if (data.activeSessionId && data.activeSessionId !== sessionId) {
    const current = findSession(data, data.activeSessionId)
    if (current && !current.closedAt) current.closedAt = new Date().toISOString()
  }
  target.closedAt = undefined
  data.activeSessionId = sessionId
  saveUserData(userKey, data)
  return target
}

export function replaceActiveMessages(userKey: string, messages: ChatMessage[]): void {
  const session = getActiveSession(userKey)
  if (!session) return
  const data = getUserData(userKey)
  const idx = data.sessions.findIndex((s) => s.id === session.id)
  if (idx < 0) return
  data.sessions[idx].messages = messages.slice(-MAX_MESSAGES_PER_SESSION)
  data.sessions[idx].updatedAt = new Date().toISOString()
  saveUserData(userKey, data)
}
