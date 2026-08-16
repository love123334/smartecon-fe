/** Cấu hình MCP bridge cho chatbot — bật dần qua env, không ảnh hưởng local-only mặc định. */

export interface ChatMcpConfig {
  enabled: boolean
  /** URL MCP server (SSE/HTTP) — Phase 2 */
  serverUrl: string
  /** Chỉ gọi MCP cho tool chưa có local executor */
  fallbackOnly: boolean
  /** Timeout ms cho callTool */
  timeoutMs: number
}

export function readChatMcpConfig(): ChatMcpConfig {
  const env = import.meta.env
  return {
    enabled: env.VITE_CHAT_MCP_ENABLED === 'true',
    serverUrl: (env.VITE_CHAT_MCP_SERVER_URL as string | undefined)?.trim() || '',
    fallbackOnly: env.VITE_CHAT_MCP_FALLBACK_ONLY !== 'false',
    timeoutMs: Number(env.VITE_CHAT_MCP_TIMEOUT_MS) || 8_000,
  }
}

export function isChatMcpEnabled(): boolean {
  return readChatMcpConfig().enabled
}
