import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'
import type { Product } from '@/types'

export interface InventoryInfo {
  productId: string
  productName: string
  availableQuantity: number
  reservedQuantity: number
  currentStock: number
  inventoryStatus?: string
}

interface BackendInventory {
  productId: number
  productName?: string
  availableQuantity: number
  reservedQuantity: number
  currentStock?: number
  inventoryStatus?: string
}

export type InventoryReason = 'MANUAL_ADJUST' | 'ORDER' | 'ORDER_CANCEL' | 'RETURN'

function mapInventory(data: BackendInventory): InventoryInfo {
  return {
    productId: String(data.productId),
    productName: data.productName ?? '',
    availableQuantity: data.availableQuantity,
    reservedQuantity: data.reservedQuantity,
    currentStock: data.currentStock ?? data.availableQuantity,
    inventoryStatus: data.inventoryStatus,
  }
}

export async function getInventory(productId: string): Promise<InventoryInfo> {
  const data = await http.get<BackendInventory>(apiPaths.inventory.byProduct(productId))
  return mapInventory(data)
}

export async function getInventoriesByProductIds(productIds: string[]): Promise<InventoryInfo[]> {
  const ids = [...new Set(productIds.map((id) => String(id).trim()).filter(Boolean))]
  if (!ids.length) return []
  const qs = new URLSearchParams()
  for (const id of ids) qs.append('productIds', id)
  const data = await http.get<BackendInventory[]>(
    `${apiPaths.inventory.batch}?${qs.toString()}`,
    { timeoutMs: 12_000 },
  )
  return (data ?? []).map(mapInventory)
}

export async function adjustInventory(
  productId: string,
  adjustmentQuantity: number,
  reason: InventoryReason = 'MANUAL_ADJUST',
): Promise<InventoryInfo> {
  const data = await http.put<BackendInventory>(apiPaths.inventory.update(productId), {
    adjustmentQuantity,
    reason,
  })
  return mapInventory(data)
}

/** One batch request instead of N inventory GETs (was the main catalog lag). */
export async function attachStockToProducts(products: Product[]): Promise<Product[]> {
  if (!products.length) return products
  try {
    const inventories = await getInventoriesByProductIds(products.map((p) => p.id))
    const byId = new Map(inventories.map((inv) => [inv.productId, inv.availableQuantity]))
    return products.map((p) => ({
      ...p,
      stock: byId.has(p.id) ? (byId.get(p.id) as number) : (p.stock ?? 0),
    }))
  } catch {
    // Fallback: small concurrent chunks if batch endpoint unavailable
    const out: Product[] = []
    const chunkSize = 6
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize)
      const mapped = await Promise.all(
        chunk.map(async (p) => {
          try {
            const inv = await getInventory(p.id)
            return { ...p, stock: inv.availableQuantity }
          } catch {
            return { ...p, stock: p.stock ?? 0 }
          }
        }),
      )
      out.push(...mapped)
    }
    return out
  }
}
