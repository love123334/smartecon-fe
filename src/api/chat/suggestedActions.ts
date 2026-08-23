import type { ChatIntent } from '@/api/chat/intents'
import type { ChatSuggestedAction } from '@/types'

/** Đã tắt chip gợi ý dưới bubble — giữ API để không gãy import/test. */
export function deriveSuggestedActions(
  _intent: ChatIntent | null,
  _hasProductFocus: boolean,
  _role: 'guest' | 'customer' | 'seller' | 'manager' | 'admin',
): ChatSuggestedAction[] {
  return []
}
