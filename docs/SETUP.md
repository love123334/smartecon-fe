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

## Chạy với backend (hybrid)

1. **Backend** (`capstone/backend`):
   ```powershell
   cd backend
   docker compose up -d postgres redis
   copy src\main\resources\application-dev.example.yml src\main\resources\application-dev.yml
   .\gradlew.bat bootRun
   ```
2. **Frontend**:
   ```powershell
   cd smart-ecommerce-dssp-frontend
   # .env: VITE_USE_MOCK=false, VITE_API_BASE_URL=/api/v1
   npm run dev
   ```

| Biến | Mock | Hybrid (backend) |
|------|------|------------------|
| `VITE_USE_MOCK` | `true` | `false` |
| `VITE_API_BASE_URL` | `/api/v1` | `/api/v1` |

**Tài khoản seed backend** (mật khẩu `12345678`):

| Role | Email |
|------|--------|
| Customer | customer@sedsp.vn |
| Seller | seller@sedsp.vn |
| Manager | manager@sedsp.vn |
| Admin | admin@sedsp.vn |

> Auth + profile gọi API thật. Sản phẩm/giỏ/đơn vẫn mock cho đến khi backend có endpoint.

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
