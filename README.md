# SEDSP Frontend (smartecon-fe)

Giao diện **Smart E-Commerce Decision Support Platform** — Vue 3 + TypeScript.

| Repo | URL |
|------|-----|
| Frontend (repo này) | https://github.com/love123334/smartecon-fe |
| Backend | https://github.com/linhtnt2004/smart-ecommerce-dssp |

## Chạy nhanh

```bash
npm run setup   # install + tạo .env
npm run dev
```

Mở http://localhost:5173 — chi tiết [docs/SETUP.md](docs/SETUP.md)

## Cấu trúc

```text
src/
├── api/          # Mock services + HTTP client (chuẩn bị backend)
├── components/   # UI dùng chung
├── views/        # Guest, Customer, Seller, Manager, Admin
├── stores/       # Pinia (auth, cart)
└── router/       # RBAC guards
```

## Demo (mock)

Mật khẩu: `123456`

| Role | Email |
|------|--------|
| Customer | customer@sedsp.vn |
| Seller | seller@sedsp.vn |
| Manager | manager@sedsp.vn |
| Admin | admin@sedsp.vn |

## Kết nối backend

Mặc định chạy **mock** (`localStorage`). Khi API Spring Boot sẵn sàng:

```bash
cp .env.example .env
# VITE_USE_MOCK=false
```

| Tài liệu | Nội dung |
|----------|----------|
| [docs/BACKEND-HANDOFF.md](docs/BACKEND-HANDOFF.md) | **Yêu cầu API đầy đủ cho team backend** |
| [docs/API-INTEGRATION.md](docs/API-INTEGRATION.md) | Tích hợp FE ↔ BE, proxy, JWT |
| [docs/SETUP.md](docs/SETUP.md) | Cài đặt & biến môi trường |

Proxy Vite: `/api` → `http://localhost:8080`

## Scripts

| Lệnh | Mô tả |
|------|--------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Xem bản build |

## Tech stack

Vue 3 · TypeScript · Vite · Pinia · Vue Router · Chart.js
