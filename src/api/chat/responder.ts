import type { ChatContext } from '@/api/chat/context'
import { enrichChatContext } from '@/api/chat/enrich'
import { generateAssistantReply } from '@/api/chat/engine'
import { detectIntent } from '@/api/chat/intents'
import { callChatLlm, isLlmConfigured } from '@/api/chat/llm'
import { buildSystemPrompt } from '@/api/chat/systemPrompt'
import type { ChatMessage } from '@/types'

export type ChatReplySource = 'llm' | 'local'

export interface ChatReply {
  content: string
  source: ChatReplySource
}

/** LLM (Groq/OpenAI) nếu có key — fallback engine local */
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
  return isLlmConfigured() ? 'AI (Groq/OpenAI)' : 'Trợ lý thông minh (local)'
}
