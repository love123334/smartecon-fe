import { normalizeText } from '@/api/chat/match'
import { matchAnyKeyword, scoreKeywords } from '@/api/chat/match'
import type { UserRole } from '@/types'

export type ChatIntent =
  | 'greeting'
  | 'thanks'
  | 'help'
  | 'platform'
  | 'shop_overview'
  | 'categories'
  | 'contact_escalate'
  | 'complaint'
  | 'shipping'
  | 'payment'
  | 'orders'
  | 'order_cancel'
  | 'cart'
  | 'recommend'
  | 'promo'
  | 'return_policy'
  | 'account'
  | 'password'
  | 'checkout'
  | 'product_price'
  | 'product_stock'
  | 'product_info'
  | 'product_review'
  | 'compare'
  | 'cart_summary'
  | 'order_detail'
  | 'category_browse'
  | 'product_search'
  | 'seller_top_products'
  | 'seller_recent_orders'
  | 'seller_revenue'
  | 'seller_inventory'
  | 'seller_pricing'
  | 'seller_promo'
  | 'seller_add_product'
  | 'seller_orders'
  | 'seller_rating'
  | 'manager_kpi'
  | 'manager_pending'
  | 'manager_segment'
  | 'manager_whatif'
  | 'manager_trend'
  | 'manager_revenue'
  | 'manager_insights'
  | 'admin_system'
  | 'admin_users'
  | 'admin_security'
  | 'admin_alerts'
  | 'admin_config'

interface IntentRule {
  intent: ChatIntent
  keywords: string[]
  roles?: UserRole[]
  minScore?: number
}

const COMMON: IntentRule[] = [
  {
    intent: 'greeting',
    keywords: [
      'xin chao', 'chao ban', 'chao shop', 'hello', 'hi', 'hey', 'good morning',
      'good afternoon', 'chao admin', 'chao ae',
    ],
  },
  {
    intent: 'thanks',
    keywords: ['cam on', 'thank you', 'thanks', 'thanks you', 'cam on ban', 'tks'],
  },
  {
    intent: 'help',
    keywords: [
      'giup toi', 'giup minh', 'help me', 'huong dan', 'lam sao', 'ho tro',
      'how to', 'how do i', 'what can you do', 'ban lam duoc gi',
    ],
  },
  {
    intent: 'platform',
    keywords: [
      'sedsp la gi', 've ung dung', 've sedsp', 'what is sedsp', 'about platform',
      'nentang', 'smart ecommerce',
    ],
  },
  {
    intent: 'shop_overview',
    keywords: [
      'web ban gi', 'ban gi vay', 'ban gi', 'shop ban gi', 'cua hang ban gi',
      'ban nhung gi', 'co nhung san pham gi', 'what do you sell', 'what does this sell',
      'what products', 'what items', 'sell what', 'catalog', 'co gi', 'ban hang gi',
      'website ban gi', 'trang nay ban gi', 'shop co gi', 'web ban j', 'ban j',
      'ban gi the', 'shop sell', 'what is sold', 'products available', 'hang hoa',
      'mua gi o day', 'co ban gi', 'store sell', 'what can i buy', 'san pham nao',
    ],
    minScore: 3,
  },
  {
    intent: 'categories',
    keywords: [
      'danh muc', 'categories', 'category', 'nhom hang', 'loai san pham',
      'co may danh muc', 'phan loai',
    ],
  },
  {
    intent: 'category_browse',
    keywords: [
      'dien tu co gi', 'thoi trang co gi', 'sach co gi', 'san pham dien tu',
      'hang dien tu', 'do choi', 'phu kien', 'browse category', 'products in',
      'co nhung gi trong', 'xem danh muc',
    ],
    minScore: 3,
  },
  {
    intent: 'product_search',
    keywords: [
      'tim kiem', 'tim sp', 'search for', 'find product', 'kiem san pham',
      'co ban', 'shop co', 'lookup',
    ],
  },
  {
    intent: 'contact_escalate',
    keywords: [
      'lien he', 'contact', 'hotline', 'email', 'goi ai', 'hoi ai', 'nhan vien',
      'support', 'customer service', 'cskh', 'tu van truc tiep', 'gap nguoi',
      'noi chuyen voi', 'chuyen sang', 'chuyen cho', 'admin xu ly', 'manager xu ly',
    ],
  },
  {
    intent: 'complaint',
    keywords: [
      'khieu nai', 'phan nan', 'complaint', 'that vong', 'te qua', 'lua dao',
      'scam', 'khong hai long', 'sai hang', 'giao sai', 'loi', 'bug',
    ],
  },
  {
    intent: 'shipping',
    keywords: [
      'giao hang', 'ship', 'van chuyen', 'delivery', 'phi ship', 'shipping fee',
      'bao lau nhan', 'khi nao nhan', 'tracking', 'theo doi van chuyen',
      'ship hang', 'giao bao lau', 'free ship', 'mien phi ship',
    ],
  },
  {
    intent: 'payment',
    keywords: [
      'thanh toan', 'payment', 'pay', 'cod', 'tien mat', 'chuyen khoan', 'bank transfer',
      'momo', 'vi dien tu', 'the tin dung', 'credit card', 'visa', 'tra gop',
      'how to pay', 'cach thanh toan',
    ],
  },
  {
    intent: 'orders',
    keywords: [
      'don hang', 'order', 'theo doi don', 'dat hang', 'mua hang', 'my order',
      'order status', 'trang thai don', 'don cua toi', 'lich su mua',
    ],
  },
  {
    intent: 'order_detail',
    keywords: [
      'chi tiet don', 'don so', 'order id', 'order number', 'ma don',
      'trang thai don', 'don nay', 'theo doi don so',
    ],
  },
  {
    intent: 'order_cancel',
    keywords: ['huy don', 'cancel order', 'huy hang', 'cancel my order', 'doi y'],
  },
  {
    intent: 'cart',
    keywords: ['gio hang', 'cart', 'shopping cart', 'them vao gio', 'xem gio'],
  },
  {
    intent: 'cart_summary',
    keywords: [
      'gio co gi', 'trong gio', 'cart total', 'tong gio', 'bao nhieu mon',
      'cart items', 'my cart', 'gio hang cua toi', 'tien gio hang',
    ],
  },
  {
    intent: 'recommend',
    keywords: [
      'goi y', 'recommend', 'nen mua', 'tu van san pham', 'san pham phu hop',
      'suggest', 'what should i buy', 'ke hoach mua', 'mua gi', 'best product',
    ],
  },
  {
    intent: 'promo',
    keywords: [
      'khuyen mai', 'sale', 'giam gia', 'discount', 'flash sale', 'uu dai',
      'promo code', 'ma giam gia', 'voucher', 'coupon', 'deal',
    ],
  },
  {
    intent: 'return_policy',
    keywords: [
      'doi tra', 'return', 'refund', 'hoan tien', 'bao hanh', 'warranty',
      'doi hang', 'tra hang', 'exchange',
    ],
  },
  {
    intent: 'account',
    keywords: [
      'dang ky', 'dang nhap', 'register', 'login', 'sign up', 'sign in',
      'tai khoan', 'account', 'tao tai khoan', 'logout', 'dang xuat',
    ],
  },
  {
    intent: 'password',
    keywords: [
      'quen mat khau', 'forgot password', 'reset password', 'doi mat khau',
      'change password', 'mat khau', 'password',
    ],
  },
  {
    intent: 'checkout',
    keywords: [
      'checkout', 'thanh toan don', 'dat hang nhu the nao', 'how to order',
      'cach mua', 'mua sao', 'place order', 'check out',
    ],
  },
  {
    intent: 'product_price',
    keywords: [
      'gia', 'bao nhieu', 'price', 'cost', 'how much', 'tien', 'don gia',
      'het bao nhieu', 'gia bao nhieu',
    ],
  },
  {
    intent: 'product_stock',
    keywords: [
      'ton kho', 'con hang', 'het hang', 'stock', 'available', 'in stock',
      'out of stock', 'con khong', 'co san khong', 'con bao nhieu',
    ],
  },
  {
    intent: 'product_info',
    keywords: [
      'thong tin', 'mo ta', 'description', 'spec', 'cau hinh', 'chi tiet',
      'product info', 'san pham nay', 'hang nay',
    ],
  },
  {
    intent: 'product_review',
    keywords: [
      'danh gia', 'review', 'rating', 'sao', 'stars', 'nhan xet', 'comment',
      'tot khong', 'co tot khong', 'quality',
    ],
  },
  {
    intent: 'compare',
    keywords: ['so sanh', 'compare', 'khac nhau', 'vs', 'hon', 'better'],
  },
]

const SELLER: IntentRule[] = [
  {
    intent: 'seller_revenue',
    keywords: ['doanh thu', 'revenue', 'sales', 'ban duoc bao nhieu', 'aov', 'doanh so'],
    roles: ['seller'],
  },
  {
    intent: 'seller_inventory',
    keywords: ['ton kho', 'inventory', 'sku', 'sap het', 'het hang', 'nhap hang', 'restock'],
    roles: ['seller'],
  },
  {
    intent: 'seller_pricing',
    keywords: ['gia ca', 'pricing', 'dieu chinh gia', 'canh tranh', 'competitive price'],
    roles: ['seller'],
  },
  {
    intent: 'seller_promo',
    keywords: ['khuyen mai', 'promo', 'marketing', 'ke hoach ban', 'chien luoc', 'flash sale', 'bundle'],
    roles: ['seller'],
  },
  {
    intent: 'seller_add_product',
    keywords: ['them san pham', 'tao sp', 'add product', 'upload anh', 'dang ban'],
    roles: ['seller'],
  },
  {
    intent: 'seller_orders',
    keywords: ['xu ly don', 'don hang seller', 'process order', 'ship don'],
    roles: ['seller'],
  },
  {
    intent: 'seller_recent_orders',
    keywords: ['don gan day', 'recent order', 'don moi', 'latest order', 'don vua dat'],
    roles: ['seller'],
  },
  {
    intent: 'seller_top_products',
    keywords: ['ban chay', 'top product', 'best seller', 'sp ban nhieu', 'hang ban chay'],
    roles: ['seller'],
  },
  {
    intent: 'seller_rating',
    keywords: ['rating', 'danh gia shop', 'review shop', 'sao trung binh'],
    roles: ['seller'],
  },
]

const MANAGER: IntentRule[] = [
  { intent: 'manager_kpi', keywords: ['kpi', 'dashboard', 'tom tat', 'bao cao', 'chi so', 'summary report'], roles: ['manager'] },
  { intent: 'manager_pending', keywords: ['don cho', 'pending', 'cho xu ly', 'backlog'], roles: ['manager'] },
  { intent: 'manager_segment', keywords: ['phan khuc', 'segment', 'customer segment', 'danh muc doanh thu'], roles: ['manager'] },
  { intent: 'manager_whatif', keywords: ['what if', 'whatif', 'mo phong', 'scenario', 'giam 10'], roles: ['manager'] },
  { intent: 'manager_trend', keywords: ['xu huong', 'trend', 'tang truong', 'forecast', 'du bao'], roles: ['manager'] },
  { intent: 'manager_revenue', keywords: ['doanh thu', 'gmv', 'revenue total'], roles: ['manager'] },
  {
    intent: 'manager_insights',
    keywords: ['goi y quan ly', 'insights', 'dss quan ly', 'de xuat', 'canh bao van hanh'],
    roles: ['manager'],
  },
]

const ADMIN: IntentRule[] = [
  { intent: 'admin_system', keywords: ['he thong', 'system status', 'service', 'backend', 'api health', 'trang thai'], roles: ['admin'] },
  { intent: 'admin_users', keywords: ['nguoi dung', 'users', 'tai khoan', 'how many users', 'role user'], roles: ['admin'] },
  { intent: 'admin_security', keywords: ['bao mat', 'security', 'jwt', 'rbac', 'permission'], roles: ['admin'] },
  { intent: 'admin_alerts', keywords: ['canh bao', 'alert', 'warning', 'error rate', 'incident'], roles: ['admin'] },
  { intent: 'admin_config', keywords: ['cloudinary', 'config', 'environment', 'oauth', 'mail smtp'], roles: ['admin'] },
]

const ALL_RULES = [...COMMON, ...SELLER, ...MANAGER, ...ADMIN]

export function detectIntent(
  raw: string,
  role: UserRole,
): { intent: ChatIntent; score: number } | null {
  const normalized = normalizeText(raw)
  if (!normalized) return null

  let best: { intent: ChatIntent; score: number } | null = null

  for (const rule of ALL_RULES) {
    if (rule.roles?.length && !rule.roles.includes(role)) continue

    const score = scoreKeywords(normalized, rule.keywords)
    const min = rule.minScore ?? (rule.intent === 'shop_overview' ? 3 : 4)
    if (score >= min && (!best || score > best.score)) {
      best = { intent: rule.intent, score }
    }
  }

  return best
}

export function hasKeyword(normalized: string, keywords: string[]): boolean {
  return matchAnyKeyword(normalized, keywords, 0.65)
}
