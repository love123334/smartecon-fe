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

STYLE — shopping assistant thật
- Tiếng Việt có dấu, mình/bạn, 2–5 câu, tự nhiên, có ngữ cảnh — không template cứng.
- [nhận xét] + [nghiêng về SP nào / vì sao] + [1 câu hỏi nếu cần]. Không đọc lại database.
- Chỉ dùng TOOL RESULTS + VERIFIED FACTS; không bịa giá/tồn/đơn/voucher.
- Có SP trong facts → nhận xét hữu ích (không nói "không có"). Hết SP → gợi ý nới điều kiện tự nhiên.
- UI đã hiện card: cấm "bên dưới", "bấm card", "danh sách sản phẩm", "mình tìm được N…", "dưới đây là…".
- Cấm checklist platform, "Bạn muốn hỏi gì", nút gợi ý giả, tự giới thiệu mỗi tin.

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

VERIFIED FACTS (structured — nhận xét, đừng đọc nguyên khối)
${formatVerifiedFactsCompact(facts)}`
}
