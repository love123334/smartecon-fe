import { describe, expect, it } from 'vitest'
import { mapMcpResultToChatTool, chatToolToMcpName } from '@/api/chat/mcp/adapter'
import { readChatMcpConfig, isChatMcpEnabled } from '@/api/chat/mcp/config'
import { listMcpMappableTools } from '@/api/chat/tools/registry'
import { executeChatToolsAsync } from '@/api/chat/toolExecutor'
import type { ChatContext } from '@/api/chat/context'

describe('chat MCP prep', () => {
  it('maps chat tool names to MCP names', () => {
    expect(chatToolToMcpName('search_products')).toBe('sedsp.search_products')
    expect(chatToolToMcpName('get_manager_kpi')).toBe('sedsp.get_manager_kpi')
  })

  it('maps MCP JSON content to ChatToolResult', () => {
    const result = mapMcpResultToChatTool('get_product', {
      content: [{ type: 'json', json: { id: '1', name: 'Test' } }],
    })
    expect(result.ok).toBe(true)
    expect(result.source).toBe('mcp')
    expect(result.data.name).toBe('Test')
  })

  it('defaults MCP disabled in test env', () => {
    expect(isChatMcpEnabled()).toBe(false)
    expect(readChatMcpConfig().enabled).toBe(false)
  })

  it('lists mappable tools for seller product route', () => {
    const defs = listMcpMappableTools('seller', 'PRODUCT_QUERY')
    expect(defs.length).toBeGreaterThan(0)
    expect(defs.every((d) => d.mcpName?.startsWith('sedsp.'))).toBe(true)
  })

  it('executeChatToolsAsync falls back to local when MCP off', async () => {
    const ctx = {
      products: [{ id: '1', name: 'A', price: 100, stock: 5, category: 'X', shopName: 'S' }],
      enrichment: {},
    } as unknown as ChatContext
    const results = await executeChatToolsAsync('guest', 'UNKNOWN', ctx)
    expect(results.some((r) => r.name === 'search_products')).toBe(true)
    expect(results.every((r) => r.source === 'local')).toBe(true)
  })
})
