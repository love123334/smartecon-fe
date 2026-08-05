import type { DssInsight } from '@/types'

/** Làm sạch commentary DSS trước khi hiển thị (lớp bảo vệ phía FE). */
export function sanitizeDssCommentary(raw: string): string {
  let text = (raw || '').trim()
  if (!text) return text

  text = text
    .replace(/\n*-{2,}\s*\n*Metrics snapshot:[\s\S]*$/i, '')
    .replace(/\n*Metrics snapshot:[\s\S]*$/i, '')
    .replace(/\/api\/v1\/[^\s)\]]+/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(
      /\b(powerbiFeed|topProducts|productId|lowStockCount|inventoryMessage|inventoryOverall|sellerId)\b/gi,
      '',
    )
    // CJK lẫn vào
    .replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]+/g, '')
    .replace(/^(?:#{1,3}\s*|\*{1,2}\s*)Nhan\s*xet(?:\s+tinh\s+hinh)?\s*\*{0,2}\s*$/gim, '## Nhận xét tình hình')
    .replace(/^(?:#{1,3}\s*|\*{1,2}\s*)Ke\s*hoach(?:\s+hanh\s+dong)?\s*\*{0,2}\s*$/gim, '## Kế hoạch hành động')
    .replace(/^(?:#{1,3}\s*|\*{1,2}\s*)Rui\s*ro(?:\s+can\s+theo\s+doi)?\s*\*{0,2}\s*$/gim, '## Rủi ro cần theo dõi')
    .replace(/^(?:#{1,3}\s*|\*{1,2}\s*)Nhận xét(?:\s*\([^)]*\))?\s*\*{0,2}\s*$/gim, '## Nhận xét tình hình')
    .replace(/^(?:#{1,3}\s*|\*{1,2}\s*)Kế hoạch(?:\s+hành động|\s+đề xuất)?(?:\s*\([^)]*\))?\s*\*{0,2}\s*$/gim, '## Kế hoạch hành động')
    .replace(/^(?:#{1,3}\s*|\*{1,2}\s*)Rủi ro(?:\s+cần theo dõi)?\s*\*{0,2}\s*$/gim, '## Rủi ro cần theo dõi')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const hasRisk = /##\s*Rủi ro/i.test(text)
  const riskEmpty = (() => {
    const idx = text.toLowerCase().indexOf('## rủi ro')
    if (idx < 0) return true
    const after = text
      .slice(idx)
      .replace(/^##\s*Rủi ro[^\n]*\n*/i, '')
      .trim()
    return !after || after.startsWith('##')
  })()

  if (!hasRisk || riskEmpty) {
    text = text.replace(/\n*##\s*Rủi ro[^\n]*\s*$/i, '').trim()
    text +=
      '\n\n## Rủi ro cần theo dõi\n' +
      '- Tồn kho không theo kịp nhu cầu thực tế nếu chậm nhập hàng.\n' +
      '- Số liệu bán chạy thay đổi nhanh khi có khuyến mãi đột xuất.\n' +
      '- Thiếu theo dõi hàng ngày dễ bỏ lỡ sản phẩm sắp hết.'
  }

  return text.trim()
}

/** Nhận xét vận hành cho Manager DSS (không dùng what-if seller). */
export function buildManagerDssCommentary(
  insights: Array<Pick<DssInsight, 'title' | 'description'> & { category?: string }>,
): string {
  const bullets =
    insights.length > 0
      ? insights.map((i) => `- **${i.title}**: ${i.description}`).join('\n')
      : '- Chưa có đủ số liệu đơn hàng để phân tích sâu — kiểm tra Doanh thu sàn / Dashboard.'

  return [
    '## Nhận xét tình hình',
    'DSS Quản lý tập trung vào vận hành toàn sàn: GMV, đơn chờ, và hiệu suất danh mục.',
    'What-if giảm giá theo sản phẩm thuộc phạm vi Người bán (không nằm ở đây).',
    '',
    '## Kế hoạch hành động',
    '1. Mở **Doanh thu sàn** / Looker Studio để rà GMV và top seller/product.',
    '2. Ưu tiên xử lý đơn chờ trên Dashboard để giảm tỷ lệ hủy.',
    '3. Dùng **Phân tích** để theo dõi danh mục tăng/giảm.',
    '4. Phối hợp seller dùng DSS (nhu cầu / giá / what-if) khi cần can thiệp SKU.',
    '',
    '## Điểm nổi bật từ dữ liệu',
    bullets,
    '',
    '## Rủi ro cần theo dõi',
    '- Đơn chờ tích tụ làm giảm trải nghiệm khách và doanh thu thực thu.',
    '- GMV tăng nhưng tỷ lệ giao thành công thấp → cần kiểm tra fulfillment.',
    '- Thiếu dữ liệu DELIVERED khiến báo cáo Looker / API lệch thực tế.',
  ].join('\n')
}
