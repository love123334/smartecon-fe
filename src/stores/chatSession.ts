import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  emptyConversationContext,
  type ConversationContext,
} from '@/api/chat/conversationContext'
import type { ChatTurnTelemetry } from '@/api/chat/chatTelemetry'

/**
 * Trạng thái phiên chat (working memory + telemetry lượt gần nhất).
 * Lịch sử tin nhắn vẫn lưu qua chatApi/localStorage — store này giữ context runtime.
 */
export const useChatSessionStore = defineStore('chatSession', () => {
  const conversation = ref<ConversationContext>(emptyConversationContext())
  const lastTelemetry = ref<ChatTurnTelemetry | null>(null)

  function applyTurn(ctx: ConversationContext, telemetry: ChatTurnTelemetry) {
    conversation.value = ctx
    lastTelemetry.value = telemetry
  }

  function resetSession() {
    conversation.value = emptyConversationContext()
    lastTelemetry.value = null
  }

  return {
    conversation,
    lastTelemetry,
    applyTurn,
    resetSession,
  }
})
