import type { McpCallToolRequest, McpCallToolResult, McpClient, McpToolDescriptor } from '@/api/chat/tools/types'
import { readChatMcpConfig } from '@/api/chat/mcp/config'

/** Stub — Phase 1: không gọi network; Phase 2: fetch/SSE tới MCP server. */
export class StubMcpClient implements McpClient {
  async listTools(): Promise<McpToolDescriptor[]> {
    return []
  }

  async callTool(_req: McpCallToolRequest): Promise<McpCallToolResult> {
    return {
      content: [{ type: 'text', text: 'MCP_NOT_CONFIGURED' }],
      isError: true,
    }
  }
}

let cachedClient: McpClient | null = null

export function getMcpClient(): McpClient {
  if (cachedClient) return cachedClient
  const cfg = readChatMcpConfig()
  if (!cfg.enabled || !cfg.serverUrl) {
    cachedClient = new StubMcpClient()
    return cachedClient
  }
  // Phase 2: return new HttpMcpClient(cfg)
  cachedClient = new StubMcpClient()
  return cachedClient
}

export function resetMcpClientForTests(): void {
  cachedClient = null
}
