# Tích hợp Frontend ↔ Backend

> **Team backend:** đọc [BACKEND-HANDOFF.md](./BACKEND-HANDOFF.md) — contract API đầy đủ, DTO, checklist, thứ tự triển khai.

## Cấu trúc monorepo local

```text
capstone/
├── smart-ecommerce-dssp/          # Backend (Spring Boot) — GitHub team
└── smart-ecommerce-dssp-frontend/ # Frontend (Vue 3) — repo riêng
```

## Chạy cùng lúc

**Terminal 1 — Backend** (khi đã có API):

```bash
cd smart-ecommerce-dssp
docker-compose up -d    # PostgreSQL + Redis
gradlew.bat bootRun
```

**Terminal 2 — Frontend:**

```bash
cd smart-ecommerce-dssp-frontend
cp .env.example .env
npm run dev
```

| Dịch vụ | URL |
|---------|-----|
| UI | http://localhost:5173 |
| API (proxy `/api`) | http://localhost:8080 |
| Swagger | http://localhost:8080/swagger-ui/index.html |

## Biến môi trường (`.env`)

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `VITE_USE_MOCK` | `true` | `false` → gọi backend thật |
| `VITE_API_BASE_URL` | `/api` | Prefix REST (Vite proxy → :8080) |
| `VITE_BACKEND_ORIGIN` | `http://localhost:8080` | Gốc server |

## Response chuẩn backend

```json
{
  "success": true,
  "message": "Request successful",
  "data": {}
}
```

Client: `src/api/http/client.ts` — tự unwrap `data`, gắn `Authorization: Bearer`.

## Map module ↔ màn hình FE

| Backend module | Frontend | API paths (dự kiến) |
|----------------|----------|---------------------|
| auth | Login, Register | `auth/login`, `auth/register` |
| user | Profile, Admin users | `users/*` |
| product | Product list/detail, Seller CRUD | `products/*` |
| inventory | Seller inventory | `inventory/products/{id}` |
| order | Cart, checkout, orders | `cart/*`, `orders/*` |
| analytics | Manager/Seller dashboards | `analytics/*` |
| DSS (future) | DSS views | `dss/*` |
| AI (future) | Recommendations, chatbot | `ai/*` |

Chi tiết path: `src/api/http/paths.ts` · DTO: `src/api/contracts/dto.ts`.

## JWT

1. `POST /api/auth/login` → lưu `accessToken` vào `localStorage` key `sedsp_access_token`
2. Mọi request sau gửi header `Authorization: Bearer <token>`
3. Role backend: `ADMIN`, `MANAGER`, `SELLER`, `CUSTOMER` — map sang lowercase trong FE router

## Chuyển từ mock sang API thật

1. Backend triển khai endpoint khớp `apiPaths`
2. Tạo `src/api/real/*.ts` gọi `http.get/post...`
3. Trong `services.ts` (hoặc `api/index.ts`): `if (apiConfig.useMock) mock else real`
4. Đặt `VITE_USE_MOCK=false` trong `.env`

Hiện tại **toàn bộ UI dùng mock** (`src/api/services.ts`) để demo đủ chức năng theo SRS/docx.
