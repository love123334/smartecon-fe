import type { ChatRoute } from '@/api/chat/intentRouter'
import type { ChatToolDefinition, ChatToolName } from '@/api/chat/tools/types'
import type { UserRole } from '@/types'

export const CHAT_TOOL_DEFINITIONS: ChatToolDefinition[] = [
  {
    name: 'search_products',
    description: 'Tìm sản phẩm trong catalog theo ngữ cảnh chat',
    mcpName: 'sedsp.search_products',
    roles: ['guest', 'customer', 'seller', 'manager', 'admin'],
    routes: ['PRODUCT_QUERY', 'CATALOG_INSIGHT', 'UNKNOWN'],
  },
  {
    name: 'get_product',
    description: 'Chi tiết SP đang focus',
    mcpName: 'sedsp.get_product',
    roles: ['guest', 'customer', 'seller', 'manager', 'admin'],
    routes: ['PRODUCT_QUERY', 'PRICE_RECOMMENDATION', 'WHAT_IF'],
  },
  {
    name: 'get_inventory',
    description: 'Tồn kho seller',
    mcpName: 'sedsp.get_inventory',
    roles: ['seller'],
    routes: ['PRODUCT_QUERY', 'INVENTORY'],
  },
  {
    name: 'get_cart',
    description: 'Giỏ hàng khách',
    mcpName: 'sedsp.get_cart',
    roles: ['customer', 'seller'],
    routes: ['ORDERS_CART'],
  },
  {
    name: 'get_orders',
    description: 'Đơn hàng người dùng',
    mcpName: 'sedsp.get_orders',
    roles: ['customer', 'seller'],
    routes: ['ORDERS_CART'],
  },
  {
    name: 'get_seller_sales',
    description: 'Doanh thu / bán hàng seller',
    mcpName: 'sedsp.get_seller_sales',
    roles: ['seller'],
    routes: ['SALES_ANALYSIS', 'WHAT_IF'],
  },
  {
    name: 'get_seller_dashboard',
    description: 'Dashboard KPI seller',
    mcpName: 'sedsp.get_seller_dashboard',
    roles: ['seller', 'admin'],
    routes: ['SALES_ANALYSIS', 'INVENTORY'],
  },
  {
    name: 'get_dss_insights',
    description: 'Insight DSS (demand, price, what-if brief)',
    mcpName: 'sedsp.get_dss_insights',
    roles: ['seller', 'manager'],
    routes: ['PRICE_RECOMMENDATION', 'WHAT_IF', 'MANAGER_OPS', 'SALES_ANALYSIS'],
  },
  {
    name: 'get_manager_kpi',
    description: 'KPI toàn sàn (manager)',
    mcpName: 'sedsp.get_manager_kpi',
    roles: ['manager', 'admin'],
    routes: ['MANAGER_OPS'],
  },
  {
    name: 'get_catalog_insights',
    description: 'Insight catalog (pattern, top seller) — không dump list',
    mcpName: 'sedsp.get_catalog_insights',
    roles: ['guest', 'customer', 'seller', 'manager', 'admin'],
    routes: ['CATALOG_INSIGHT', 'PRODUCT_QUERY', 'SALES_ANALYSIS'],
  },
]

const TOOLS_BY_ROLE: Record<UserRole, ChatToolName[]> = {
  guest: ['search_products', 'get_product', 'get_catalog_insights'],
  customer: ['search_products', 'get_product', 'get_cart', 'get_orders', 'get_catalog_insights'],
  seller: [
    'search_products',
    'get_product',
    'get_inventory',
    'get_cart',
    'get_orders',
    'get_seller_sales',
    'get_seller_dashboard',
    'get_dss_insights',
    'get_catalog_insights',
  ],
  manager: [
    'search_products',
    'get_product',
    'get_manager_kpi',
    'get_dss_insights',
    'get_catalog_insights',
  ],
  admin: [
    'search_products',
    'get_product',
    'get_manager_kpi',
    'get_seller_dashboard',
    'get_catalog_insights',
  ],
}

const ROUTE_TOOLS: Record<ChatRoute, ChatToolName[]> = {
  GENERAL_CHAT: [],
  PRODUCT_QUERY: ['search_products', 'get_product', 'get_inventory', 'get_catalog_insights'],
  CATALOG_INSIGHT: ['get_catalog_insights', 'search_products'],
  SALES_ANALYSIS: ['get_seller_sales', 'get_seller_dashboard', 'get_catalog_insights'],
  INVENTORY: ['get_inventory', 'get_seller_dashboard'],
  PRICE_RECOMMENDATION: ['get_dss_insights', 'get_product'],
  WHAT_IF: ['get_dss_insights', 'get_product', 'get_seller_sales'],
  ORDERS_CART: ['get_cart', 'get_orders'],
  MANAGER_OPS: ['get_manager_kpi', 'get_dss_insights'],
  UNKNOWN: ['search_products'],
}

export function getAllowedTools(role: UserRole, route: ChatRoute): ChatToolName[] {
  const roleSet = new Set(TOOLS_BY_ROLE[role] ?? TOOLS_BY_ROLE.customer)
  return ROUTE_TOOLS[route].filter((t) => roleSet.has(t))
}

export function getToolDefinition(name: ChatToolName): ChatToolDefinition | undefined {
  return CHAT_TOOL_DEFINITIONS.find((d) => d.name === name)
}

export function listMcpMappableTools(role: UserRole, route: ChatRoute): ChatToolDefinition[] {
  const allowed = new Set(getAllowedTools(role, route))
  return CHAT_TOOL_DEFINITIONS.filter((d) => allowed.has(d.name) && d.mcpName)
}
