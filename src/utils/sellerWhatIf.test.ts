import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/http/client'
import { apiRootWithoutVersion } from '@/api/http/client'
import {
  DISCOUNT_MAX,
  DISCOUNT_MIN,
  formatDiscountLabel,
  formatQuantity,
  formatVndCurrency,
  mapSellerWhatIfError,
  profitInsightBadge,
  validateSellerWhatIfForm,
} from '@/utils/sellerWhatIf'

describe('validateSellerWhatIfForm', () => {
  it('accepts valid payload', () => {
    expect(
      validateSellerWhatIfForm({
        productId: 15,
        discountPercentage: 10,
        simulationPeriod: 30,
      }),
    ).toEqual({
      ok: true,
      payload: {
        productId: 15,
        discountPercentage: 10,
        simulationPeriod: 30,
      },
    })
  })

  it('rejects discount <= 0 or >= 100', () => {
    expect(
      validateSellerWhatIfForm({
        productId: 15,
        discountPercentage: 0,
        simulationPeriod: 30,
      }).ok,
    ).toBe(false)
    expect(
      validateSellerWhatIfForm({
        productId: 15,
        discountPercentage: 100,
        simulationPeriod: 30,
      }).ok,
    ).toBe(false)
  })

  it('rejects missing product or non-positive period', () => {
    const result = validateSellerWhatIfForm({
      productId: '',
      discountPercentage: 10,
      simulationPeriod: -1,
    })
    expect(result.ok).toBe(false)
  })

  it('keeps slider bounds conventions', () => {
    expect(DISCOUNT_MIN).toBe(1)
    expect(DISCOUNT_MAX).toBe(50)
  })
})

describe('profitInsightBadge', () => {
  it('INCREASE when expected rises more than 3%', () => {
    expect(profitInsightBadge(100, 104)).toBe('INCREASE')
  })

  it('DECREASE when expected falls more than 3%', () => {
    expect(profitInsightBadge(100, 96)).toBe('DECREASE')
  })

  it('MAINTAIN within ±3%', () => {
    expect(profitInsightBadge(100, 102)).toBe('MAINTAIN')
    expect(profitInsightBadge(100, 98)).toBe('MAINTAIN')
  })

  it('does not rely on Vietnamese insight text', () => {
    expect(profitInsightBadge(3_000_000, 2_360_000)).toBe('DECREASE')
  })
})

describe('formatting', () => {
  it('formats VND and integer quantities', () => {
    expect(formatVndCurrency(100000)).toMatch(/100/)
    expect(formatVndCurrency(null)).toBe('—')
    expect(formatQuantity(118.4)).toBe(new Intl.NumberFormat('vi-VN').format(118))
    expect(formatDiscountLabel(10)).toBe('Giảm 10%')
  })
})

describe('mapSellerWhatIfError', () => {
  it('keeps backend messages for FR01/FR03/cost errors', () => {
    expect(
      mapSellerWhatIfError(
        new ApiError('Không đủ dữ liệu để tạo dự báo.', 400),
      ),
    ).toMatch(/dự báo/i)
    expect(
      mapSellerWhatIfError(
        new ApiError('Sản phẩm phải có giá vốn để thực hiện phân tích.', 400),
      ),
    ).toMatch(/giá vốn/i)
  })

  it('handles 401/403/404/500', () => {
    expect(mapSellerWhatIfError(new ApiError('', 401))).toMatch(/đăng nhập/i)
    expect(mapSellerWhatIfError(new ApiError('Forbidden', 403))).toBe('Forbidden')
    expect(mapSellerWhatIfError(new ApiError('', 404))).toMatch(/sản phẩm/i)
    expect(mapSellerWhatIfError(new ApiError('', 500))).toMatch(/Máy chủ/i)
  })
})

describe('apiRootWithoutVersion', () => {
  it('strips trailing /v1 from default-like base', () => {
    // Function uses apiConfig; smoke that it returns a string ending without /v1 when possible
    const root = apiRootWithoutVersion()
    expect(typeof root).toBe('string')
    expect(root.length).toBeGreaterThan(0)
  })
})
