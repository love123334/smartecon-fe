import { describe, expect, it } from 'vitest'
import { voucherUserMessage } from '@/utils/voucherCheckout'

describe('voucherUserMessage', () => {
  it('hides technical DB errors', () => {
    expect(
      voucherUserMessage(
        'Không xử lý được dữ liệu DSS/đơn hàng. Kiểm tra schema DB đã migrate.',
      ),
    ).toMatch(/thử lại/i)
  })

  it('keeps friendly invalid voucher text', () => {
    expect(voucherUserMessage('Mã voucher không hợp lệ hoặc không áp dụng cho giỏ hàng này.')).toContain(
      'không dùng được',
    )
  })
})
