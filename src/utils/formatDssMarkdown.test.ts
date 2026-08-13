import { describe, expect, it } from 'vitest'
import { formatDssMarkdown } from '@/utils/formatDssMarkdown'

describe('formatDssMarkdown', () => {
  it('renders headings and bold without raw ##', () => {
    const html = formatDssMarkdown('## Nhận xét tình hình\n\nDữ liệu **SEDSP** ổn.', {
      sanitize: false,
    })
    expect(html).toContain('<h4')
    expect(html).toContain('Nhận xét tình hình')
    expect(html).not.toContain('## ')
    expect(html).toContain('<strong>SEDSP</strong>')
  })

  it('renders numbered and bullet lists', () => {
    const html = formatDssMarkdown(
      '## Kế hoạch\n1. Mở **Dự báo nhu cầu**\n2. Chạy giá\n\n## Rủi ro\n- Hết hàng\n- Thiếu data',
      { sanitize: false },
    )
    expect(html).toContain('<ol')
    expect(html).toContain('<li>Mở <strong>Dự báo nhu cầu</strong></li>')
    expect(html).toContain('<ul')
    expect(html).toContain('<li>Hết hàng</li>')
  })
})
