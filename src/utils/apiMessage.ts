/** Map thông báo lỗi API (thường tiếng Anh) sang tiếng Việt cho UI. */
const EXACT: Record<string, string> = {
  'Invalid email or password': 'Email hoặc mật khẩu không đúng.',
  'Account is inactive': 'Tài khoản chưa được kích hoạt. Kiểm tra email OTP.',
  'Account is blocked': 'Tài khoản đã bị khóa. Liên hệ quản trị viên.',
  'Email does not exist': 'Email không tồn tại trong hệ thống.',
  'Account is not active': 'Tài khoản chưa được kích hoạt.',
  'Password confirmation does not match': 'Xác nhận mật khẩu không khớp.',
  'OTP not found': 'Chưa xác minh OTP. Vui lòng nhập mã từ email.',
  'Invalid email or OTP': 'Email hoặc mã OTP không hợp lệ.',
  'Request failed': 'Yêu cầu thất bại. Vui lòng thử lại.',
  'API error': 'Lỗi hệ thống. Vui lòng thử lại.',
}

const CONTAINS: [RegExp, string][] = [
  [
    /Không xử lý được dữ liệu DSS/i,
    'Không áp dụng được mã giảm giá lúc này. Kiểm tra mã (vd. SEDSP10) và thử lại.',
  ],
  [/schema DB|lịch sử bán/i, 'Không áp dụng được mã giảm giá. Kiểm tra mã và thử lại.'],
  [/Invalid or expired OTP/i, 'Mã OTP không hợp lệ hoặc đã hết hạn.'],
  [/voucher|coupon/i, 'Mã giảm giá không hợp lệ hoặc không áp dụng cho giỏ hàng.'],
]

export function localizeApiMessage(message: string | null | undefined): string {
  const raw = (message ?? '').trim()
  if (!raw) return 'Đã xảy ra lỗi. Vui lòng thử lại.'

  const exact = EXACT[raw]
  if (exact) return exact

  for (const [pattern, vi] of CONTAINS) {
    if (pattern.test(raw)) return vi
  }

  return raw
}
