# Hướng dẫn Backend — Tích hợp với Frontend SEDSP

Tài liệu này dành cho team **Spring Boot** (`smart-ecommerce-dssp`). Frontend đã chuẩn bị sẵn HTTP client, đường dẫn API và kiểu dữ liệu — backend chỉ cần implement đúng contract bên dưới.

| Thành phần | Repo / path |
|------------|-------------|
| Frontend | https://github.com/love123334/smartecon-fe |
| Backend | https://github.com/linhtnt2004/smart-ecommerce-dssp |
| API paths (FE) | `src/api/http/paths.ts` |
| DTO contract (FE) | `src/api/contracts/dto.ts` |
| HTTP client | `src/api/http/client.ts` |
| Mock hiện tại | `src/api/services.ts` |

---

## 1. Quy ước chung

### Base URL

- Prefix: **`/api`**
- Ví dụ: `GET http://localhost:8080/api/products`
- Frontend dev proxy: Vite chuyển `/api` → `http://localhost:8080` (xem `vite.config.ts`)

### Response wrapper (bắt buộc)

Mọi endpoint trả JSON theo chuẩn backend repo (`docs/api-response-standard.md`):

```json
{
  "success": true,
  "message": "Request successful",
  "data": { }
}
```

Lỗi:

```json
{
  "success": false,
  "message": "Email hoặc mật khẩu không đúng",
  "errors": [{ "field": "email", "message": "..." }]
}
```

Frontend `client.ts` tự unwrap `data` khi `success === true`.

### Naming

- JSON field: **`camelCase`** (khớp TypeScript FE: `fullName`, `imageUrl`, `soldCount`)
- Role enum backend: **`ADMIN` | `MANAGER` | `SELLER` | `CUSTOMER`**
- FE map sang lowercase cho router: `admin`, `manager`, `seller`, `customer`
- Date/time: **ISO-8601** string (`2026-06-12T10:30:00.000Z`)

### CORS (khi deploy tách domain)

```text
Allowed origins: http://localhost:5173, <production-fe-url>
Allowed headers: Authorization, Content-Type
Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

### JWT

| Mục | Giá trị |
|-----|---------|
| Header | `Authorization: Bearer <accessToken>` |
| Login response `data` | `{ "accessToken": "...", "user": { ... } }` |
| FE lưu token | `localStorage` key `sedsp_access_token` |
| Endpoint profile | `GET /api/auth/me` |

---

## 2. Thứ tự triển khai đề xuất

| Phase | Module | Ưu tiên | Màn hình FE |
|-------|--------|---------|-------------|
| 1 | Auth + User profile | P0 | Login, Register, Profile |
| 2 | Product + Category | P0 | Trang chủ, Search, Chi tiết SP |
| 3 | Cart + Order | P0 | Giỏ, Checkout, Đơn hàng |
| 4 | Inventory (seller) | P1 | Seller inventory |
| 5 | Analytics | P1 | Manager/Seller dashboard |
| 6 | DSS + AI | P2 | DSS views, Chatbot, Gợi ý |

---

## 3. Chi tiết API theo module

### 3.1 Auth (`/api/auth/*`)

#### `POST /api/auth/login`

**Body:**
```json
{ "email": "customer@sedsp.vn", "password": "123456" }
```

**Response `data`:**
```json
{
  "accessToken": "eyJhbG...",
  "user": {
    "id": "u-customer",
    "email": "customer@sedsp.vn",
    "fullName": "Nguyễn Văn Khách",
    "role": "CUSTOMER",
    "phone": "0901234567",
    "address": "123 Lê Lợi, Q1, TP.HCM",
    "createdAt": "2026-06-12T00:00:00.000Z",
    "active": true
  }
}
```

**Lỗi:** `401` — message tiếng Việt: `"Email hoặc mật khẩu không đúng"`

#### `POST /api/auth/register`

**Body:**
```json
{
  "email": "new@example.com",
  "password": "secret",
  "fullName": "Tên người dùng",
  "phone": "0900000000"
}
```

**Response `data`:** giống `user` ở login, role mặc định `CUSTOMER`.

**Lỗi:** `409` — `"Email đã được sử dụng"`

#### `POST /api/auth/logout`

**Auth:** Bearer token. Response `data`: `null` hoặc `{}`.

#### `GET /api/auth/me`

**Auth:** Bearer. **Response `data`:** object `User` (không có password).

---

### 3.2 Users (`/api/users/*`) — Admin

| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| GET | `/users` | Danh sách user | ADMIN |
| GET | `/users/{id}` | Chi tiết | ADMIN |
| PATCH | `/users/{id}/profile` | Cập nhật profile | Owner / ADMIN |
| PATCH | `/users/{id}/activate` | Kích hoạt | ADMIN |
| PATCH | `/users/{id}/deactivate` | Khóa | ADMIN |
| PATCH | `/users/{id}/role` | Đổi role | ADMIN |

**Body đổi role:** `{ "role": "SELLER" }`

---

### 3.3 Products (`/api/products/*`)

#### `GET /api/products`

**Query (optional):** `q`, `category`, `sellerId`

**Response `data`:** `Product[]`

```json
[
  {
    "id": "p1",
    "name": "Tai nghe Bluetooth Pro ANC",
    "description": "...",
    "price": 1890000,
    "originalPrice": 2490000,
    "stock": 45,
    "category": "Điện tử",
    "imageUrl": "https://...",
    "sellerId": "u-seller",
    "shopName": "SEDSP Tech Mall",
    "shopLocation": "TP.HCM",
    "rating": 4.6,
    "reviewCount": 89,
    "soldCount": 128,
    "isFlashSale": true,
    "createdAt": "2026-06-12T00:00:00.000Z"
  }
]
```

#### `GET /api/products/{id}`

**Response `data`:** `Product` hoặc `404`.

#### `GET /api/products/search`

Alias của list với `q` — hoặc dùng chung handler `GET /products?q=`.

#### `POST /api/products` — Seller

**Auth:** SELLER. Body: omit `id`, `sellerId`, `createdAt`, `soldCount`, `rating` (server gán).

#### `PUT /api/products/{id}` — Seller (owner)

**Body:** partial `Product`.

#### `DELETE /api/products/{id}` — Seller (owner)

**Response:** `204` hoặc wrapper success.

#### `GET /api/products/categories` *(đề xuất thêm)*

**Response `data`:** `string[]` — FE mock dùng `productApi.categories()`.

> Nếu chưa có endpoint riêng, có thể trả categories trong metadata của `GET /products`.

---

### 3.4 Cart (`/api/cart/*`) — Customer

Giỏ hàng gắn user đăng nhập (JWT `sub`).

| Method | Path | Body | Response `data` |
|--------|------|------|-----------------|
| GET | `/cart` | — | `CartItem[]` |
| POST | `/cart/items` | `{ "productId": "p1", "quantity": 1 }` | `CartItem[]` |
| PATCH | `/cart/items/{productId}` | `{ "quantity": 2 }` | `CartItem[]` |
| DELETE | `/cart/items/{productId}` | — | `CartItem[]` |
| DELETE | `/cart` | — | `null` |

**CartItem:**
```json
{ "productId": "p1", "quantity": 2 }
```

**Lỗi tồn kho:** `400` — `"Không đủ tồn kho"`

---

### 3.5 Orders (`/api/orders/*`)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/orders/me` | Đơn của customer hiện tại |
| GET | `/orders` | Tất cả đơn (seller/manager/admin) |
| GET | `/orders/{id}` | Chi tiết |
| POST | `/orders/checkout` | Đặt hàng từ giỏ |
| PATCH | `/orders/{id}/status` | Cập nhật trạng thái (seller/admin) |
| GET | `/orders/{id}/tracking` | Timeline vận chuyển *(optional P2)* |

**Checkout body:**
```json
{ "shippingAddress": "123 Lê Lợi, Q1, TP.HCM" }
```

**Order `data`:**
```json
{
  "id": "o-123",
  "customerId": "u-customer",
  "customerName": "Nguyễn Văn Khách",
  "items": [
    {
      "productId": "p1",
      "productName": "Tai nghe...",
      "quantity": 1,
      "unitPrice": 1890000
    }
  ],
  "total": 1890000,
  "status": "pending",
  "shippingAddress": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Status enum:** `pending` | `confirmed` | `shipping` | `delivered` | `cancelled`

---

### 3.6 Inventory (`/api/inventory/*`) — Seller

| Method | Path | Body |
|--------|------|------|
| GET | `/inventory/products/{productId}` | — → `{ "stock": 45, "lowStockThreshold": 20 }` |
| PATCH | `/inventory/products/{productId}` | `{ "stock": 50 }` |

---

### 3.7 Analytics (`/api/analytics/*`) — Manager / Seller

| Path | Response `data` |
|------|-----------------|
| `GET /analytics/sales` | `ChartPoint[]` → `{ "label": "T1", "value": 12500000 }` |
| `GET /analytics/revenue` | `ChartPoint[]` |
| `GET /analytics/products/trends` | `ChartPoint[]` |
| `GET /analytics/customers` | object tùy dashboard |
| `GET /analytics/kpi` | KPI summary |

---

### 3.8 DSS (`/api/dss/*`) — Phase 2

| Path | Response |
|------|----------|
| `GET /dss/insights` | `DssInsight[]` |
| `GET /dss/demand/{productId}` | forecast object |
| `GET /dss/price/{productId}` | pricing suggestion |
| `GET /dss/inventory/{productId}` | reorder suggestion |
| `POST /dss/what-if` | simulation result |

**DssInsight:**
```json
{
  "id": "d1",
  "title": "Nhập thêm hàng",
  "description": "...",
  "impact": "high",
  "category": "inventory"
}
```

---

### 3.9 AI (`/api/ai/*`) — Phase 2

| Path | Body / Response |
|------|-----------------|
| `GET /ai/recommendations` | `Recommendation[]` |
| `POST /ai/chat` | `{ "message": "..." }` → assistant reply + history |

**Recommendation:**
```json
{ "productId": "p2", "score": 0.92, "reason": "Dựa trên lịch sử mua hàng" }
```

---

### 3.10 Admin (`/api/admin/*`)

| Path | Response `data` |
|------|-----------------|
| `GET /admin/metrics` | `SystemMetric[]` |
| `GET /admin/logs` | log entries *(optional)* |

**SystemMetric:**
```json
{ "name": "PostgreSQL", "value": "Connected", "status": "ok" }
```

`status`: `ok` | `warn` | `error`

---

## 4. Seed data gợi ý (khớp demo FE)

Để QA cùng tài khoản demo trên UI:

| Email | Password | Role |
|-------|----------|------|
| customer@sedsp.vn | 123456 | CUSTOMER |
| seller@sedsp.vn | 123456 | SELLER |
| manager@sedsp.vn | 123456 | MANAGER |
| admin@sedsp.vn | 123456 | ADMIN |

Sản phẩm mẫu: xem `src/api/mockData.ts` (10 SKU, categories: Điện tử, Thời trang, …).

---

## 5. Checklist tích hợp

### Backend

- [ ] `SecdspApplication` + `@SpringBootApplication` chạy được
- [ ] Flyway migrations (users, products, orders, …)
- [ ] `ApiResponse<T>` wrapper cho mọi controller
- [ ] JWT filter + RBAC theo role
- [ ] Swagger tại `/swagger-ui/index.html`
- [ ] CORS cho `localhost:5173`
- [ ] Endpoint Phase 1 pass Postman collection

### Frontend (khi API sẵn sàng)

- [ ] Tạo `src/api/real/*.ts` gọi `http` client
- [ ] Branch `apiConfig.useMock` trong `services.ts`
- [ ] `.env`: `VITE_USE_MOCK=false`
- [ ] Test login → list products → cart → checkout → orders

---

## 6. Chạy local full-stack

```bash
# Terminal 1 — Backend
cd smart-ecommerce-dssp
docker-compose up -d
gradlew.bat bootRun

# Terminal 2 — Frontend
cd smart-ecommerce-dssp-frontend
npm run setup    # hoặc: cp .env.example .env && npm install
npm run dev
```

| URL | Dịch vụ |
|-----|---------|
| http://localhost:5173 | Frontend UI |
| http://localhost:8080/api/... | REST API |
| http://localhost:8080/swagger-ui/index.html | Swagger |

---

## 7. Liên hệ / tham chiếu

- Kiến trúc backend: `smart-ecommerce-dssp/docs/project-architecture.md`
- Quy tắc code BE: `smart-ecommerce-dssp/docs/backend-rules.md`
- Tích hợp ngắn (FE): [API-INTEGRATION.md](./API-INTEGRATION.md)
- Setup FE: [SETUP.md](./SETUP.md)

Khi backend thay đổi contract, **báo FE** để cập nhật `src/api/contracts/dto.ts` và `paths.ts`.
