import { isShortGreeting, normalizeText, phraseBoost, scoreKeywords, matchAnyKeyword } from '@/api/chat/match'
import type { UserRole } from '@/types'

export type ChatIntent =
  | 'greeting'
  | 'thanks'
  | 'help'
  | 'platform'
  | 'shop_overview'
  | 'categories'
  | 'contact_escalate'
  | 'contact_seller'
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
  | 'product_cheapest'
  | 'product_budget'
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
  /** Cụm nguyên câu — boost mạnh khi khớp */
  phrases?: string[]
  roles?: UserRole[]
  minScore?: number
  /** Ưu tiên khi điểm gần nhau (cao hơn thắng) */
  priority?: number
}

const COMMON: IntentRule[] = [
  {
    intent: 'greeting',
    keywords: ['xin chao', 'chao ban', 'chao shop', 'hello', 'hi', 'hey', 'alo'],
    phrases: ['xin chao', 'chao shop', 'hello', 'hi'],
    minScore: 2,
    priority: 8,
  },
  {
    intent: 'thanks',
    keywords: ['cam on', 'thank you', 'thanks', 'tks', 'cam on ban'],
    phrases: ['cam on', 'thank you'],
    minScore: 3,
    priority: 9,
  },
  {
    intent: 'help',
    keywords: [
      'giup toi', 'giup minh', 'help me', 'huong dan', 'ho tro',
      'ban lam duoc gi', 'what can you do', 'tro giup',
    ],
    phrases: ['ban lam duoc gi', 'giup toi', 'what can you do'],
    minScore: 4,
    priority: 6,
  },
  {
    intent: 'platform',
    keywords: ['sedsp la gi', 've ung dung', 've sedsp', 'what is sedsp', 'about platform', 'smart ecommerce'],
    phrases: ['sedsp la gi', 'what is sedsp'],
    minScore: 4,
    priority: 7,
  },
  {
    intent: 'shop_overview',
    keywords: [
      'web ban gi', 'ban gi vay', 'ban gi', 'shop ban gi', 'cua hang ban gi',
      'ban nhung gi', 'co nhung san pham gi', 'what do you sell', 'what products',
      'catalog', 'ban hang gi', 'website ban gi', 'shop co gi', 'web ban j', 'ban j',
      'mua gi o day', 'co ban gi', 'what can i buy', 'san pham nao', 'hang hoa',
    ],
    phrases: [
      'web ban gi', 'ban gi vay', 'what do you sell', 'shop ban gi', 'cua hang ban gi',
      'co nhung san pham gi', 'mua gi o day',
    ],
    minScore: 3,
    priority: 10,
  },
  {
    intent: 'categories',
    keywords: ['danh muc', 'categories', 'category', 'nhom hang', 'loai san pham', 'phan loai'],
    phrases: ['danh muc', 'co may danh muc'],
    minScore: 4,
    priority: 7,
  },
  {
    intent: 'category_browse',
    keywords: [
      'dien tu co gi', 'thoi trang co gi', 'the thao co gi', 'gia dung co gi',
      'san pham dien tu', 'hang dien tu', 'browse category', 'xem danh muc',
    ],
    phrases: ['dien tu co gi', 'thoi trang co gi', 'the thao co gi', 'gia dung co gi'],
    minScore: 3,
    priority: 8,
  },
  {
    intent: 'product_search',
    keywords: ['tim kiem', 'tim sp', 'search for', 'find product', 'kiem san pham', 'lookup'],
    phrases: ['tim kiem', 'search for', 'find product'],
    minScore: 4,
    priority: 6,
  },
  {
    intent: 'product_cheapest',
    keywords: [
      're nhat', 'gia re nhat', 'cheapest', 're nhat la gi', 'sp re', 'hang re',
      'gia thap nhat', 'lowest price', 're nhat shop',
    ],
    phrases: ['re nhat', 'gia re nhat', 'cheapest', 'lowest price'],
    minScore: 4,
    priority: 11,
  },
  {
    intent: 'product_budget',
    keywords: [
      'duoi', 'under', 'ngan sach', 'budget', 'toi da', 'trong khoang',
      'gia re', 'tiet kiem', 're hon',
    ],
    phrases: ['duoi', 'ngan sach', 'budget', 'under'],
    minScore: 3,
    priority: 9,
  },
  {
    intent: 'contact_seller',
    keywords: [
      'lien he nguoi ban', 'contact seller', 'gap nguoi ban', 'nguoi ban mon',
      'email nguoi ban', 'goi nguoi ban', 'lien lac nguoi ban', 'seller cua mon',
      'lien he shop', 'gap shop ban', 'noi chuyen voi nguoi ban', 'can lien he nguoi ban',
      'seller san pham', 'shop ban mon',
    ],
    phrases: [
      'lien he nguoi ban', 'contact seller', 'gap nguoi ban', 'lien he shop',
      'noi chuyen voi nguoi ban',
    ],
    minScore: 3,
    priority: 12,
  },
  {
    intent: 'contact_escalate',
    keywords: [
      'lien he', 'contact', 'hotline', 'email', 'cskh', 'customer service',
      'tu van truc tiep', 'gap nhan vien', 'chuyen sang', 'admin xu ly', 'manager xu ly',
      'support',
    ],
    phrases: ['hotline', 'customer service', 'cskh', 'tu van truc tiep'],
    minScore: 4,
    priority: 5,
  },
  {
    intent: 'complaint',
    keywords: [
      'khieu nai', 'phan nan', 'complaint', 'that vong', 'lua dao', 'scam',
      'khong hai long', 'sai hang', 'giao sai',
    ],
    phrases: ['khieu nai', 'phan nan', 'complaint'],
    minScore: 4,
    priority: 8,
  },
  {
    intent: 'shipping',
    keywords: [
      'giao hang', 'ship', 'van chuyen', 'delivery', 'phi ship', 'shipping fee',
      'bao lau nhan', 'khi nao nhan', 'tracking', 'free ship', 'mien phi ship',
    ],
    phrases: ['giao hang', 'phi ship', 'mien phi ship', 'free ship', 'bao lau nhan'],
    minScore: 4,
    priority: 8,
  },
  {
    intent: 'payment',
    keywords: [
      'thanh toan', 'payment', 'cod', 'chuyen khoan', 'momo', 'vi dien tu',
      'cach thanh toan', 'how to pay', 'tra gop',
    ],
    phrases: ['thanh toan', 'cach thanh toan', 'how to pay', 'chuyen khoan'],
    minScore: 4,
    priority: 8,
  },
  {
    intent: 'orders',
    keywords: [
      'don hang', 'my order', 'order status', 'trang thai don', 'don cua toi',
      'lich su mua', 'theo doi don',
    ],
    phrases: ['don cua toi', 'lich su mua', 'my order', 'theo doi don'],
    minScore: 4,
    priority: 7,
  },
  {
    intent: 'order_detail',
    keywords: ['chi tiet don', 'don so', 'order id', 'order number', 'ma don', 'don nay'],
    phrases: ['chi tiet don', 'ma don', 'order id'],
    minScore: 4,
    priority: 8,
  },
  {
    intent: 'order_cancel',
    keywords: ['huy don', 'cancel order', 'huy hang', 'cancel my order'],
    phrases: ['huy don', 'cancel order'],
    minScore: 4,
    priority: 9,
  },
  {
    intent: 'cart',
    keywords: ['gio hang', 'cart', 'shopping cart', 'them vao gio', 'xem gio'],
    phrases: ['gio hang', 'them vao gio', 'shopping cart'],
    minScore: 4,
    priority: 7,
  },
  {
    intent: 'cart_summary',
    keywords: [
      'gio co gi', 'trong gio', 'cart total', 'tong gio', 'my cart',
      'gio hang cua toi', 'tien gio hang',
    ],
    phrases: ['gio co gi', 'trong gio', 'gio hang cua toi', 'my cart'],
    minScore: 4,
    priority: 8,
  },
  {
    intent: 'recommend',
    keywords: [
      'goi y', 'recommend', 'nen mua', 'tu van san pham', 'suggest',
      'what should i buy', 'best product', 'goi y mua',
    ],
    phrases: ['nen mua', 'goi y san pham', 'what should i buy'],
    minScore: 4,
    priority: 7,
  },
  {
    intent: 'promo',
    keywords: [
      'khuyen mai', 'sale', 'giam gia', 'discount', 'flash sale', 'uu dai',
      'voucher', 'coupon', 'deal', 'ma giam gia',
    ],
    phrases: ['khuyen mai', 'flash sale', 'ma giam gia', 'giam gia'],
    minScore: 4,
    priority: 7,
  },
  {
    intent: 'return_policy',
    keywords: ['doi tra', 'return', 'refund', 'hoan tien', 'bao hanh', 'warranty', 'tra hang'],
    phrases: ['doi tra', 'bao hanh', 'hoan tien'],
    minScore: 4,
    priority: 8,
  },
  {
    intent: 'account',
    keywords: [
      'dang ky', 'dang nhap', 'register', 'login', 'sign up', 'tai khoan',
      'tao tai khoan', 'logout', 'dang xuat',
    ],
    phrases: ['dang nhap', 'dang ky', 'tao tai khoan'],
    minScore: 4,
    priority: 7,
  },
  {
    intent: 'password',
    keywords: ['quen mat khau', 'forgot password', 'reset password', 'doi mat khau', 'change password'],
    phrases: ['quen mat khau', 'forgot password', 'doi mat khau'],
    minScore: 4,
    priority: 9,
  },
  {
    intent: 'checkout',
    keywords: [
      'checkout', 'dat hang nhu the nao', 'how to order', 'cach mua', 'place order',
      'mua sao', 'cach dat hang',
    ],
    phrases: ['cach mua', 'how to order', 'dat hang nhu the nao', 'cach dat hang'],
    minScore: 4,
    priority: 8,
  },
  {
    intent: 'product_price',
    keywords: ['gia bao nhieu', 'bao nhieu tien', 'how much', 'price of', 'cost', 'don gia'],
    phrases: ['gia bao nhieu', 'bao nhieu tien', 'how much', 'gia may'],
    minScore: 4,
    priority: 8,
  },
  {
    intent: 'product_stock',
    keywords: [
      'con hang', 'het hang', 'ton kho', 'in stock', 'out of stock', 'con khong',
      'co san khong', 'con bao nhieu',
    ],
    phrases: ['con hang khong', 'het hang chua', 'con bao nhieu', 'in stock'],
    minScore: 4,
    priority: 8,
  },
  {
    intent: 'product_info',
    keywords: ['thong tin', 'mo ta', 'description', 'cau hinh', 'chi tiet sp', 'product info'],
    phrases: ['thong tin san pham', 'mo ta', 'cau hinh'],
    minScore: 4,
    priority: 6,
  },
  {
    intent: 'product_review',
    keywords: ['danh gia', 'review', 'rating', 'nhan xet', 'tot khong', 'co tot khong'],
    phrases: ['danh gia', 'review', 'tot khong'],
    minScore: 4,
    priority: 7,
  },
  {
    intent: 'compare',
    keywords: ['so sanh', 'compare', 'vs', 'khac nhau', 'hon cai nao'],
    phrases: ['so sanh', 'compare', 'vs'],
    minScore: 4,
    priority: 8,
  },
]

const SELLER: IntentRule[] = [
  {
    intent: 'seller_revenue',
    keywords: ['doanh thu', 'revenue', 'sales', 'ban duoc bao nhieu', 'aov', 'doanh so'],
    phrases: ['doanh thu', 'doanh so'],
    roles: ['seller'],
    priority: 8,
  },
  {
    intent: 'seller_inventory',
    keywords: ['ton kho', 'inventory', 'sku', 'sap het', 'nhap hang', 'restock'],
    phrases: ['ton kho', 'sap het hang'],
    roles: ['seller'],
    priority: 8,
  },
  {
    intent: 'seller_pricing',
    keywords: ['gia ca', 'pricing', 'dieu chinh gia', 'canh tranh'],
    roles: ['seller'],
    priority: 6,
  },
  {
    intent: 'seller_promo',
    keywords: ['ke hoach ban', 'chien luoc', 'flash sale', 'bundle', 'marketing'],
    roles: ['seller'],
    priority: 6,
  },
  {
    intent: 'seller_add_product',
    keywords: ['them san pham', 'tao sp', 'add product', 'upload anh', 'dang ban'],
    phrases: ['them san pham', 'add product'],
    roles: ['seller'],
    priority: 8,
  },
  {
    intent: 'seller_orders',
    keywords: ['xu ly don', 'don hang seller', 'process order', 'ship don', 'quan ly don'],
    phrases: ['xu ly don', 'quan ly don hang'],
    roles: ['seller'],
    priority: 8,
  },
  {
    intent: 'seller_recent_orders',
    keywords: ['don gan day', 'recent order', 'don moi', 'latest order'],
    roles: ['seller'],
    priority: 7,
  },
  {
    intent: 'seller_top_products',
    keywords: ['ban chay', 'top product', 'best seller', 'sp ban nhieu'],
    phrases: ['ban chay', 'best seller'],
    roles: ['seller'],
    priority: 7,
  },
  {
    intent: 'seller_rating',
    keywords: ['rating shop', 'danh gia shop', 'review shop', 'sao trung binh'],
    roles: ['seller'],
    priority: 7,
  },
]

const MANAGER: IntentRule[] = [
  { intent: 'manager_kpi', keywords: ['kpi', 'dashboard', 'tom tat', 'bao cao', 'chi so'], phrases: ['kpi', 'tom tat'], roles: ['manager'], priority: 8 },
  { intent: 'manager_pending', keywords: ['don cho', 'pending', 'cho xu ly', 'backlog'], phrases: ['don cho', 'cho xu ly'], roles: ['manager'], priority: 8 },
  { intent: 'manager_segment', keywords: ['phan khuc', 'segment', 'danh muc doanh thu'], roles: ['manager'], priority: 7 },
  { intent: 'manager_whatif', keywords: ['what if', 'whatif', 'mo phong', 'scenario', 'giam 10'], phrases: ['what if', 'mo phong'], roles: ['manager'], priority: 9 },
  { intent: 'manager_trend', keywords: ['xu huong', 'trend', 'tang truong', 'forecast', 'du bao'], roles: ['manager'], priority: 7 },
  { intent: 'manager_revenue', keywords: ['doanh thu', 'gmv', 'revenue total'], roles: ['manager'], priority: 7 },
  { intent: 'manager_insights', keywords: ['goi y quan ly', 'insights', 'dss quan ly', 'de xuat'], roles: ['manager'], priority: 7 },
]

const ADMIN: IntentRule[] = [
  { intent: 'admin_system', keywords: ['he thong', 'system status', 'api health', 'trang thai dich vu'], phrases: ['trang thai he thong'], roles: ['admin'], priority: 8 },
  { intent: 'admin_users', keywords: ['nguoi dung', 'users', 'bao nhieu user', 'role user'], roles: ['admin'], priority: 7 },
  { intent: 'admin_security', keywords: ['bao mat', 'security', 'jwt', 'rbac'], roles: ['admin'], priority: 8 },
  { intent: 'admin_alerts', keywords: ['canh bao', 'alert', 'incident', 'error rate'], roles: ['admin'], priority: 7 },
  { intent: 'admin_config', keywords: ['cloudinary', 'config', 'environment', 'oauth', 'mail smtp'], roles: ['admin'], priority: 7 },
]

const ALL_RULES = [...COMMON, ...SELLER, ...MANAGER, ...ADMIN]

function refineIntent(
  normalized: string,
  detected: { intent: ChatIntent; score: number },
): ChatIntent {
  // seller contact ưu tiên hơn escalate chung
  if (
    detected.intent === 'contact_escalate' &&
    /nguoi ban|seller|shop ban|lien he shop|email shop/.test(normalized)
  ) {
    return 'contact_seller'
  }
  // "ban gi" không nên thành product_price vì có chữ "gia"
  if (
    detected.intent === 'product_price' &&
    /ban gi|web ban|shop ban|what do you sell|catalog/.test(normalized)
  ) {
    return 'shop_overview'
  }
  // ngân sách rõ ràng
  if (
    detected.intent !== 'product_budget' &&
    /duoi\s+\d|under\s+\d|budget|ngan sach|toi da\s+\d/.test(normalized)
  ) {
    return 'product_budget'
  }
  return detected.intent
}

export function detectIntent(
  raw: string,
  role: UserRole,
): { intent: ChatIntent; score: number } | null {
  const normalized = normalizeText(raw)
  if (!normalized) return null

  if (isShortGreeting(normalized)) {
    return { intent: 'greeting', score: 100 }
  }

  let best: { intent: ChatIntent; score: number; priority: number } | null = null

  for (const rule of ALL_RULES) {
    if (rule.roles?.length && !rule.roles.includes(role)) continue

    const base = scoreKeywords(normalized, rule.keywords)
    const boost = phraseBoost(normalized, rule.phrases ?? [])
    const score = base + boost
    const min = rule.minScore ?? 4
    const priority = rule.priority ?? 5

    if (score < min) continue
    if (
      !best ||
      score > best.score + 0.5 ||
      (Math.abs(score - best.score) <= 0.5 && priority > best.priority)
    ) {
      best = { intent: rule.intent, score, priority }
    }
  }

  if (!best) return null

  const intent = refineIntent(normalized, best)
  return { intent, score: best.score }
}

export function hasKeyword(normalized: string, keywords: string[]): boolean {
  return matchAnyKeyword(normalized, keywords, 0.65)
}
