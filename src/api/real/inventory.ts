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

export async function attachStockToProducts(products: Product[]): Promise<Product[]> {
  return Promise.all(
    products.map(async (p) => {
      try {
        const inv = await getInventory(p.id)
        return { ...p, stock: inv.availableQuantity }
      } catch {
        return { ...p, stock: p.stock ?? 0 }
      }
    }),
  )
}
