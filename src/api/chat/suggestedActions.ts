import type { ChatIntent } from '@/api/chat/intents'
import type { ChatSuggestedAction } from '@/types'

const MAX = 3

function action(id: string, label: string, prompt: string): ChatSuggestedAction {
  return { id, label, prompt }
}

/** Gợi ý câu hỏi tiếp theo — chỉ từ intent đã biết, không bịa SP. */
export function deriveSuggestedActions(
  intent: ChatIntent | null,
  hasProductFocus: boolean,
  role: 'guest' | 'customer' | 'seller' | 'manager' | 'admin',
): ChatSuggestedAction[] {
  if (role === 'seller') {
    if (intent === 'seller_dss_demand' || intent === 'seller_dss_price') {
      return [
        action('sw-whatif', 'What-if giá', 'what if tăng giá 10% thì sao'),
        action('sw-inv', 'Tồn kho', 'tồn kho sản phẩm nào sắp hết'),
      ]
    }
    return [
      action('sw-rev', 'Doanh thu tháng', 'doanh thu tháng này'),
      action('sw-ord', 'Đơn gần đây', 'đơn hàng gần đây'),
    ].slice(0, MAX)
  }

  if (role === 'manager') {
    return [
      action('mg-kpi', 'KPI tháng', 'kpi tháng này'),
      action('mg-pend', 'Đơn chờ duyệt', 'đơn chờ duyệt'),
    ].slice(0, MAX)
  }

  if (!hasProductFocus) {
    if (intent === 'product_search' || intent === 'recommend' || intent === 'category_browse') {
      return [
        action('br-budget', 'Dưới 2 triệu', 'tai nghe dưới 2 triệu'),
        action('br-sale', 'Đang giảm giá', 'sản phẩm đang giảm giá'),
      ]
    }
    return []
  }

  switch (intent) {
    case 'product_price':
      return [
        action('pq-stock', 'Còn hàng?', 'còn hàng không'),
        action('pq-review', 'Đánh giá khách', 'khách đánh giá sao'),
        action('pq-seller', 'Thông tin shop', 'shop bán ở đâu'),
      ]
    case 'product_stock':
      return [
        action('ps-price', 'Giá bao nhiêu', 'giá bao nhiêu'),
        action('ps-review', 'Đánh giá', 'khách thấy sao'),
      ]
    case 'product_review':
      return [
        action('pr-price', 'Giá hiện tại', 'giá bao nhiêu'),
        action('pr-seller', 'Liên hệ shop', 'thông tin người bán'),
      ]
    case 'product_info':
    case 'contact_seller':
      return [
        action('pi-price', 'Giá', 'giá bao nhiêu'),
        action('pi-stock', 'Tồn kho', 'còn hàng không'),
        action('pi-review', 'Review', 'đánh giá khách hàng'),
      ]
    case 'compare':
      return [action('cmp-detail', 'Chi tiết hơn', 'so sánh chi tiết hơn')]
    default:
      if (hasProductFocus) {
        return [
          action('def-price', 'Giá', 'giá bao nhiêu'),
          action('def-review', 'Đánh giá', 'khách đánh giá sao'),
        ]
      }
      return []
  }
}
