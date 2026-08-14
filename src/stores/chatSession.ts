import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  emptyConversationContext,
  type ConversationContext,
} from '@/api/chat/conversationContext'
import type { ChatLoginSession } from '@/api/chat/chatPersistence'
import type { ChatTurnTelemetry } from '@/api/chat/chatTelemetry'

/**
 * Trạng thái phiên chat runtime — working memory + phiên đăng nhập hiện tại.
 * Tin nhắn lưu qua chatPersistence (localStorage theo session).
 */
export const useChatSessionStore = defineStore('chatSession', () => {
  const conversation = ref<ConversationContext>(emptyConversationContext())
  const lastTelemetry = ref<ChatTurnTelemetry | null>(null)
  const activeSessionId = ref<string | null>(null)
  const sessionTitle = ref('Cuộc trò chuyện mới')

  const hasActiveSession = computed(() => Boolean(activeSessionId.value))

  function loadFromSession(session: ChatLoginSession) {
    activeSessionId.value = session.id
    sessionTitle.value = session.title
    conversation.value = session.conversation ?? emptyConversationContext()
  }

  function applyTurn(ctx: ConversationContext, telemetry: ChatTurnTelemetry) {
    conversation.value = ctx
    lastTelemetry.value = telemetry
  }

  function resetSession() {
    conversation.value = emptyConversationContext()
    lastTelemetry.value = null
    activeSessionId.value = null
    sessionTitle.value = 'Cuộc trò chuyện mới'
  }

  return {
    conversation,
    lastTelemetry,
    activeSessionId,
    sessionTitle,
    hasActiveSession,
    loadFromSession,
    applyTurn,
    resetSession,
  }
})
