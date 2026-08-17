import { describe, expect, it } from 'vitest'
import { selectableBackendStatuses } from '@/utils/backendOrderStatus'

describe('selectableBackendStatuses', () => {
  it('offers forward jumps and cancel from PENDING', () => {
    expect(selectableBackendStatuses('PENDING')).toEqual([
      'PAID',
      'PROCESSING',
      'SHIPPING',
      'DELIVERED',
      'CANCELLED',
    ])
  })

  it('offers shipping, delivered and cancel from PROCESSING', () => {
    expect(selectableBackendStatuses('PROCESSING')).toEqual([
      'SHIPPING',
      'DELIVERED',
      'CANCELLED',
    ])
  })

  it('returns empty for terminal delivered', () => {
    expect(selectableBackendStatuses('DELIVERED')).toEqual([])
  })
})
