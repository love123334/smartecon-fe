import type { ChatContext } from '@/api/chat/context'
import type { ChatRoute } from '@/api/chat/intentRouter'
import { executeLocalChatTools } from '@/api/chat/chatTools'
import { chatToolToMcpName, mapMcpResultToChatTool } from '@/api/chat/mcp/adapter'
import { isChatMcpEnabled, readChatMcpConfig } from '@/api/chat/mcp/config'
import { getMcpClient } from '@/api/chat/mcp/client'
import { getAllowedTools } from '@/api/chat/tools/registry'
import type { ChatToolName, ChatToolResult } from '@/api/chat/tools/types'
import type { UserRole } from '@/types'

/** Sync path — local executors only (production default). */
export function executeChatTools(
  role: UserRole,
  route: ChatRoute,
  ctx: ChatContext,
): ChatToolResult[] {
  return executeLocalChatTools(role, route, ctx).map((r) => ({ ...r, source: 'local' as const }))
}

/**
 * Async path — local trước; MCP bổ sung khi VITE_CHAT_MCP_ENABLED=true (Phase 2).
 * Hiện tại MCP stub → luôn trả local.
 */
export async function executeChatToolsAsync(
  role: UserRole,
  route: ChatRoute,
  ctx: ChatContext,
): Promise<ChatToolResult[]> {
  const local = executeChatTools(role, route, ctx)
  if (!isChatMcpEnabled()) return local

  const cfg = readChatMcpConfig()
  const allowed = getAllowedTools(role, route)
  const client = getMcpClient()
  const merged = new Map<ChatToolName, ChatToolResult>()
  for (const r of local) merged.set(r.name, r)

  for (const name of allowed) {
    const existing = merged.get(name)
    if (cfg.fallbackOnly && existing?.ok) continue

    const mcpName = chatToolToMcpName(name)
    if (!mcpName) continue

    try {
      const raw = await client.callTool({ name: mcpName, arguments: { role, route } })
      const mapped = mapMcpResultToChatTool(name, raw)
      if (mapped.ok || !existing?.ok) merged.set(name, mapped)
    } catch {
      /* giữ local */
    }
  }

  return [...merged.values()]
}
