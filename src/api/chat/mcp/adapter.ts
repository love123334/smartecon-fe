import type { ChatToolName, ChatToolResult, McpCallToolResult } from '@/api/chat/tools/types'
import { getToolDefinition } from '@/api/chat/tools/registry'

export function chatToolToMcpName(name: ChatToolName): string | undefined {
  return getToolDefinition(name)?.mcpName
}

/** Chuyển MCP response → ChatToolResult (JSON text hoặc structured content). */
export function mapMcpResultToChatTool(name: ChatToolName, raw: McpCallToolResult): ChatToolResult {
  if (raw.isError) {
    const errText = raw.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join(' ')
    return {
      name,
      ok: false,
      data: {},
      error: errText || 'MCP_ERROR',
      source: 'mcp',
    }
  }

  const jsonBlock = raw.content.find((c) => c.type === 'json')
  if (jsonBlock && jsonBlock.type === 'json' && jsonBlock.json && typeof jsonBlock.json === 'object') {
    return {
      name,
      ok: true,
      data: jsonBlock.json as Record<string, unknown>,
      source: 'mcp',
    }
  }

  const text = raw.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    return { name, ok: true, data: parsed, source: 'mcp' }
  } catch {
    return { name, ok: true, data: { raw: text }, source: 'mcp' }
  }
}
