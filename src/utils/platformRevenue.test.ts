import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/http/client'
import {
  MAX_RANGE_DAYS,
  categoryDisplayName,
  defaultPlatformRevenueFilter,
  formatPlatformPercent,
  inclusiveDayCount,
  mapPlatformRevenueError,
  orderStatusDisplayLabel,
  validatePlatformRevenueFilter,
} from '@/utils/platformRevenue'

describe('validatePlatformRevenueFilter', () => {
  const now = new Date('2026-07-31T12:00:00')

  it('accepts default-like valid range', () => {
    const result = validatePlatformRevenueFilter(
      {
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
        granularity: 'DAY',
        topLimit: 5,
      },
      now,
    )
    expect(result.ok).toBe(true)
  })

  it('rejects fromDate after toDate', () => {
    const result = validatePlatformRevenueFilter(
      {
        fromDate: '2026-07-31',
        toDate: '2026-07-01',
        granularity: 'DAY',
        topLimit: 5,
      },
      now,
    )
    expect(result.ok).toBe(false)
  })

  it('rejects future toDate', () => {
    const result = validatePlatformRevenueFilter(
      {
        fromDate: '2026-07-01',
        toDate: '2026-08-15',
        granularity: 'MONTH',
        topLimit: 10,
      },
      now,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.toDate).toMatch(/tương lai/i)
  })

  it('rejects range longer than 366 days', () => {
    const result = validatePlatformRevenueFilter(
      {
        fromDate: '2025-01-01',
        toDate: '2026-07-31',
        granularity: 'DAY',
        topLimit: 5,
      },
      now,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.range).toMatch(String(MAX_RANGE_DAYS))
  })
})

describe('platform revenue helpers', () => {
  it('counts inclusive days', () => {
    expect(inclusiveDayCount('2026-07-01', '2026-07-01')).toBe(1)
    expect(inclusiveDayCount('2026-07-01', '2026-07-31')).toBe(31)
  })

  it('formats null growth as em dash and signed positive percent', () => {
    expect(formatPlatformPercent(null)).toBe('—')
    expect(formatPlatformPercent(25, { signed: true })).toBe('+25%')
  })

  it('maps order status labels without changing API enums', () => {
    expect(orderStatusDisplayLabel('DELIVERED')).toBe('Đã giao')
    expect(orderStatusDisplayLabel('PENDING')).toBe('Chờ xử lý')
  })

  it('renders Chưa phân loại for null category', () => {
    expect(categoryDisplayName(null, null)).toBe('Chưa phân loại')
    expect(categoryDisplayName(null, '')).toBe('Chưa phân loại')
  })

  it('default filter uses last 30 days ending today', () => {
    const now = new Date('2026-07-31T08:00:00')
    const f = defaultPlatformRevenueFilter(now)
    expect(f.toDate).toBe('2026-07-31')
    expect(f.fromDate).toBe('2026-07-02')
    expect(f.granularity).toBe('DAY')
    expect(f.topLimit).toBe(5)
  })

  it('maps API errors', () => {
    expect(mapPlatformRevenueError(new ApiError('', 401))).toMatch(/đăng nhập/i)
    expect(mapPlatformRevenueError(new ApiError('Forbidden', 403))).toBe('Forbidden')
  })
})
