# Setup Frontend SEDSP

## Yêu cầu

| Tool | Phiên bản |
|------|-----------|
| Node.js | 20+ |
| npm | 10+ |

## Cài đặt nhanh

### Windows (PowerShell)

```powershell
cd smart-ecommerce-dssp-frontend
npm run setup
npm run dev
```

### macOS / Linux

```bash
cd smart-ecommerce-dssp-frontend
npm run setup
npm run dev
```

Script `setup` sẽ: `npm install` + tạo `.env` từ `.env.example` nếu chưa có.

## Cấu hình `.env`

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `VITE_USE_MOCK` | `true` | `false` = gọi backend thật |
| `VITE_API_BASE_URL` | `/api` | Prefix REST |
| `VITE_BACKEND_ORIGIN` | `http://localhost:8080` | URL backend (Swagger) |

## Scripts

| Lệnh | Mô tả |
|------|--------|
| `npm run setup` | Cài dependency + tạo `.env` |
| `npm run dev` | Dev server :5173 |
| `npm run build` | Build production |
| `npm run preview` | Xem bản build |

## Demo (mock mode)

Mật khẩu chung: `123456`

| Role | Email |
|------|--------|
| Customer | customer@sedsp.vn |
| Seller | seller@sedsp.vn |
| Manager | manager@sedsp.vn |
| Admin | admin@sedsp.vn |

## Tài liệu liên quan

- [BACKEND-HANDOFF.md](./BACKEND-HANDOFF.md) — yêu cầu API cho team backend
- [API-INTEGRATION.md](./API-INTEGRATION.md) — tích hợp FE ↔ BE
