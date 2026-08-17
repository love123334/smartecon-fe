import { describe, expect, it } from 'vitest'
import { localizeApiMessage } from '@/utils/apiMessage'

describe('localizeApiMessage', () => {
  it('maps known auth errors to Vietnamese', () => {
    expect(localizeApiMessage('Invalid email or password')).toBe(
      'Email hoặc mật khẩu không đúng.',
    )
  })

  it('maps technical voucher/db errors to friendly text', () => {
    expect(
      localizeApiMessage(
        'Không xử lý được dữ liệu DSS/đơn hàng. Kiểm tra sản phẩm có lịch sử bán và schema DB đã migrate.',
      ),
    ).toContain('Chưa áp dụng được mã giảm giá')
  })

  it('passes through unknown Vietnamese messages', () => {
    expect(localizeApiMessage('Mã không hợp lệ.')).toBe('Mã không hợp lệ.')
  })
})
