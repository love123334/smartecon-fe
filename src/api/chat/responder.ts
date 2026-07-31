import type { ChatContext } from '@/api/chat/context'
import { enrichChatContext } from '@/api/chat/enrich'
import { generateAssistantReply } from '@/api/chat/engine'
import { detectIntent } from '@/api/chat/intents'
import { callChatLlm, isLlmConfigured, llmProviderLabel, refreshBeAiStatus } from '@/api/chat/llm'
import { buildSystemPrompt } from '@/api/chat/systemPrompt'
import type { ChatMessage } from '@/types'

export type ChatReplySource = 'llm' | 'local'

export interface ChatReply {
  content: string
  source: ChatReplySource
}

/** Khi có LLM: ưu tiên AI + context shop; local chỉ fallback. Không có LLM: local như cũ. */
export async function resolveChatReply(
  userMessage: string,
  history: ChatMessage[],
  ctx: ChatContext,
): Promise<ChatReply> {
  const detected = detectIntent(userMessage, ctx.role)
  const enriched = await enrichChatContext(ctx, userMessage, detected?.intent ?? null)

  if (isLlmConfigured()) {
    try {
      const systemPrompt = buildSystemPrompt(enriched)
      const content = await callChatLlm(systemPrompt, history, userMessage)
      return { content, source: 'llm' }
    } catch {
      /* fallback local */
    }
  }

  return {
    content: await generateAssistantReply(userMessage, enriched),
    source: 'local',
  }
}

export function chatModeLabel(): string {
  return isLlmConfigured()
    ? `AI (${llmProviderLabel()}) + local data`
    : 'Trợ lý thông minh (local)'
}

/** Call once when opening chatbot so BE AI status is known */
export { refreshBeAiStatus }
