import { llmContradictsFacts } from '@/api/chat/followup'
import { formatVnd } from '@/api/chat/match'
import type { VerifiedFacts } from '@/api/chat/verifiedFacts'

/**
 * Nếu LLM bịa giá, chèn dòng giá đã xác minh thay vì bỏ cả câu trả lời.
 * Trả về null nếu không sửa được.
 */
export function repairPriceFactsInReply(
  llmContent: string,
  facts: VerifiedFacts,
): string | null {
  if (!facts.verifiedPricesVnd.length) return null
  if (!llmContradictsFacts(llmContent, facts)) return null

  const price = facts.verifiedPricesVnd[0]
  const name = facts.allowedProductNames[0]
  const line = name
    ? `Giá **${name}** trên hệ thống: **${formatVnd(price)}**.`
    : `Giá trên hệ thống: **${formatVnd(price)}**.`

  const trimmed = llmContent.trim()
  if (trimmed.toLowerCase().includes(formatVnd(price).toLowerCase())) {
    return trimmed
  }
  return `${trimmed}\n\n${line}`
}
