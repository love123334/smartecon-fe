import type { ChatIntent } from '@/api/chat/intents'

export type ChatFinalSource = 'local' | 'llm' | 'llm_repaired'

export type ChatFallbackReason =
  | 'force_local'
  | 'not_configured'
  | 'llm_error'
  | 'off_topic'
  | 'low_quality'
  | 'missing_facts'
  | 'contradicts_facts'
  | 'too_vague'

export interface ChatTurnTelemetry {
  intent: ChatIntent | null
  intentScore: number
  llmCalled: boolean
  llmProvider?: string
  latencyMs: number
  localLatencyMs: number
  llmLatencyMs?: number
  finalSource: ChatFinalSource
  fallbackReason?: ChatFallbackReason
  followUp: boolean
  hasAttachments: boolean
  activeTask?: string
}

export function createChatTelemetry(
  partial: Omit<ChatTurnTelemetry, 'latencyMs' | 'localLatencyMs' | 'llmCalled'> & {
    latencyMs?: number
    localLatencyMs?: number
    llmCalled?: boolean
  },
): ChatTurnTelemetry {
  const localLatencyMs = partial.localLatencyMs ?? 0
  const llmCalled = partial.llmCalled ?? false
  const latencyMs = partial.latencyMs ?? localLatencyMs
  return {
    ...partial,
    llmCalled,
    localLatencyMs,
    latencyMs,
  }
}

/** Dev-only structured log — không gửi PII ra ngoài. */
export function logChatTurn(telemetry: ChatTurnTelemetry): void {
  if (!import.meta.env.DEV) return
  const tag = `[chat:${telemetry.finalSource}]`
  const summary = {
    intent: telemetry.intent,
    score: telemetry.intentScore,
    llm: telemetry.llmCalled,
    ms: telemetry.latencyMs,
    localMs: telemetry.localLatencyMs,
    llmMs: telemetry.llmLatencyMs,
    fallback: telemetry.fallbackReason,
    followUp: telemetry.followUp,
    attach: telemetry.hasAttachments,
    task: telemetry.activeTask,
  }
  console.info(tag, summary)
}
