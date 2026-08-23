import { rolePromptBlock } from '@/api/chat/rolePolicy'
import type { ChatContext } from '@/api/chat/context'
import type { ChatRoute } from '@/api/chat/intentRouter'
import { routeLabel } from '@/api/chat/intentRouter'
import type { ChatMemoryLayers } from '@/api/chat/conversationMemory'
import {
  formatToolResultsForPrompt,
  formatVerifiedFactsCompact,
  type ChatToolResult,
} from '@/api/chat/chatTools'
import type { VerifiedFacts } from '@/api/chat/verifiedFacts'

/** System prompt gọn — giọng tư vấn shop như Gemini teammate. */
export function buildSlimSystemPrompt(
  ctx: ChatContext,
  route: ChatRoute,
  memory: ChatMemoryLayers,
  toolResults: ChatToolResult[],
  facts: VerifiedFacts,
): string {
  return `ROLE
${rolePromptBlock(ctx.role)}

STYLE (như trợ lý mua sắm SEDSP)
- Tiếng Việt có dấu, xưng mình/bạn, ngắn gọn 2–5 câu, tự nhiên — không template cứng.
- Không bịa giá/tồn/đơn/voucher; chỉ dùng TOOL RESULTS và VERIFIED FACTS.
- Có sản phẩm thì nêu tên + giá thật; không nói "không có" khi facts còn SP.
- Cấm checklist platform dài, cấm "Bạn muốn hỏi gì", cấm nút gợi ý giả.

ROUTER
${routeLabel(route)}

SESSION CONTEXT
${JSON.stringify(memory.sessionContext)}

CONVERSATION SUMMARY
${memory.summary || '—'}

CURRENT GOAL
${memory.goal || '—'}

TOOL RESULTS (backend)
${formatToolResultsForPrompt(toolResults)}

VERIFIED FACTS
${formatVerifiedFactsCompact(facts)}`
}
