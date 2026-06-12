# SEDSP Frontend

**Smart E-Commerce Decision Support Platform** — giao diện Vue 3.

Repo backend (ngang cấp): [smart-ecommerce-dssp](https://github.com/linhtnt2004/smart-ecommerce-dssp)

```text
capstone/
├── smart-ecommerce-dssp/           ← Spring Boot + PostgreSQL
└── smart-ecommerce-dssp-frontend/  ← Vue 3 (repo này)
```

## Chạy nhanh

```bash
npm install
npm run dev
```

http://localhost:5173

## Phạm vi UI (theo SRS / Report capstone)

| Vai trò | Chức năng |
|---------|-----------|
| **Guest** | Đăng ký, danh sách/chi tiết/tìm sản phẩm |
| **Customer** | Đăng nhập, hồ sơ, giỏ, checkout, đơn hàng, theo dõi, gợi ý AI, chatbot |
| **Seller** | CRUD sản phẩm, giá, tồn kho, doanh số, DSS, seller assistant |
| **Manager** | KPI dashboard, phân tích, DSS dự báo/kịch bản |
| **Admin** | Quản lý user, role, kích hoạt tài khoản, giám sát hệ thống |

## Tài khoản demo (mock)

Mật khẩu: `123456`

| Role | Email |
|------|--------|
| Customer | customer@sedsp.vn |
| Seller | seller@sedsp.vn |
| Manager | manager@sedsp.vn |
| Admin | admin@sedsp.vn |

## Kết nối backend

- Mặc định: **mock** (`localStorage`) — không cần Java chạy.
- Khi API Spring Boot xong: copy `.env.example` → `.env`, đặt `VITE_USE_MOCK=false`.
- Vite proxy `/api` → `http://localhost:8080`.

Chi tiết: [docs/API-INTEGRATION.md](docs/API-INTEGRATION.md)

## So sánh UI khác (Claude)

Prompt tạo bản UI thay thế: [docs/PROMPT-UI-ALTERNATIVE.md](docs/PROMPT-UI-ALTERNATIVE.md)

## Công nghệ

Vue 3 · TypeScript · Vite · Pinia · Vue Router · Chart.js

## Scripts

| Lệnh | Mô tả |
|------|--------|
| `npm run dev` | Dev server :5173 |
| `npm run build` | Production build |
| `npm run preview` | Xem bản build |
