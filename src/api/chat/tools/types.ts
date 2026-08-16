import type { UserRole } from '@/types'
import type { ChatRoute } from '@/api/chat/intentRouter'

/** Tool nội bộ chatbot — sẽ map 1:1 sang MCP tool khi bật bridge. */
export type ChatToolName =
  | 'search_products'
  | 'get_product'
  | 'get_inventory'
  | 'get_cart'
  | 'get_orders'
  | 'get_seller_sales'
  | 'get_seller_dashboard'
  | 'get_dss_insights'
  | 'get_manager_kpi'
  | 'get_catalog_insights'

export type ChatToolSource = 'local' | 'mcp' | 'hybrid'

export interface ChatToolResult {
  name: ChatToolName
  ok: boolean
  data: Record<string, unknown>
  error?: string
  /** Nguồn thực thi — telemetry / debug MCP rollout */
  source?: ChatToolSource
}

export interface ChatToolDefinition {
  name: ChatToolName
  description: string
  /** MCP tool name khi bridge bật (JSON-RPC / MCP server) */
  mcpName?: string
  roles: UserRole[]
  routes: ChatRoute[]
}

/** MCP tool descriptor (subset JSON Schema — mở rộng sau). */
export interface McpToolDescriptor {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface McpCallToolRequest {
  name: string
  arguments?: Record<string, unknown>
}

export interface McpCallToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'json'; json: unknown }>
  isError?: boolean
}

export interface McpClient {
  listTools(): Promise<McpToolDescriptor[]>
  callTool(req: McpCallToolRequest): Promise<McpCallToolResult>
}
