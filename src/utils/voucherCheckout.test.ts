import { describe, expect, it } from 'vitest'
import {
  consumePendingVoucherCode,
  demoPublicVouchers,
  peekPendingVoucherCode,
  rememberPendingVoucherCode,
  voucherUserMessage,
} from '@/utils/voucherCheckout'

describe('voucherUserMessage', () => {
  it('hides technical DB errors', () => {
    expect(
      voucherUserMessage(
        'Không xử lý được dữ liệu DSS/đơn hàng. Kiểm tra schema DB đã migrate.',
      ),
    ).toMatch(/thanh toán bình thường/i)
  })

  it('keeps friendly invalid voucher text', () => {
    expect(voucherUserMessage('Mã voucher không hợp lệ hoặc không áp dụng cho giỏ hàng này.')).toContain(
      'không dùng được',
    )
  })
})

describe('pending voucher code', () => {
  it('remembers and consumes a homepage code', () => {
    rememberPendingVoucherCode('sedsp10')
    expect(peekPendingVoucherCode()).toBe('SEDSP10')
    expect(consumePendingVoucherCode()).toBe('SEDSP10')
    expect(peekPendingVoucherCode()).toBe('')
  })

  it('exposes demo public vouchers for homepage fallback', () => {
    const codes = demoPublicVouchers().map((v) => v.code)
    expect(codes).toContain('SEDSP10')
    expect(codes).toContain('SHOP50K')
  })
})

describe('voucherUserMessage', () => {
  it('hides technical DB errors', () => {
    expect(
      voucherUserMessage(
        'Không xử lý được dữ liệu DSS/đơn hàng. Kiểm tra schema DB đã migrate.',
      ),
    ).toMatch(/thanh toán bình thường/i)
  })

  it('keeps friendly invalid voucher text', () => {
    expect(voucherUserMessage('Mã voucher không hợp lệ hoặc không áp dụng cho giỏ hàng này.')).toContain(
      'không dùng được',
    )
  })
})
