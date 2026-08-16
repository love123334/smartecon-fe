# SEDSP — DemoScript & Seed Data Reference

> **Mục đích:** Tài liệu tham chiếu khi demo / thuyết trình capstone. Gồm toàn bộ tài khoản seed, sản phẩm mẫu, voucher, luồng demo gợi ý và ghi chú migration.  
> **Cập nhật:** Tháng 8/2026 · Nguồn: Flyway `V2`–`V56`, `mockData.ts`, `V52` vouchers.

---

## 1. Chọn tier demo nào?

| Tier | Khi nào dùng | Login chính |
|------|----------------|-------------|
| **A — Production UI** | Demo Vercel + Railway, login nhanh trên UI | `@sedsp.vn` / `12345678` |
| **B — Capstone catalog** | Marketplace đầy đủ ~50 SP, đa seller | `@secdsp.com` / mật khẩu theo role |
| **C — DSS analytics** | DSS demand / price / what-if, lịch sử bán 121 ngày | `seller.dss.demo@example.com` / `password` |
| **Mock offline** | Không có backend, `VITE_USE_MOCK=true` | `@sedsp.vn` / `123456` |

**Lưu ý:** UI login và chatbot gợi ý **Tier A**. Tier B/C dùng khi cần dataset lớn hoặc DSS sâu.

---

## 2. Tier A — Tài khoản `@sedsp.vn` (khuyến nghị demo chính)

**Migration:** `V24__seed_dev_data.sql`, `V25`, `V52`  
**Frontend mock:** `smart-ecommerce-dssp-frontend/src/api/mockData.ts`

| Role | Email | Password (BE) | Password (mock FE) | Ghi chú |
|------|-------|---------------|---------------------|---------|
| Khách hàng | `customer@sedsp.vn` | `12345678` | `123456` | Mua hàng, giỏ, chatbot, gợi ý AI |
| Người bán | `seller@sedsp.vn` | `12345678` | `123456` | Shop **SEDSP Official**, quản lý SP |
| Quản lý | `manager@sedsp.vn` | `12345678` | `123456` | KPI, voucher nền tảng |
| Admin | `admin@sedsp.vn` | `12345678` | `123456` | Users, giám sát, export seed |

**Mẹo UI:** Trang **Đăng nhập** → giữ **Ctrl** + click nút **Đăng nhập** → chọn chip demo.

### 2.1 Sản phẩm V24 (backend) + mock p1–p10 (frontend)

| Slug / ID | Tên | Giá (VNĐ) | Danh mục | Shop |
|-----------|-----|-----------|----------|------|
| `tai-nghe-bluetooth-pro-anc` / p1 | Tai nghe Bluetooth Pro ANC | 1.890.000 | Điện tử | SEDSP Official |
| `ban-phim-co-rgb-keypro-k87` / p2 | Bàn phím cơ RGB KeyPro K87 | 2.450.000 | Điện tử | SEDSP Tech Mall |
| p3 | Áo thun cotton organic Unisex | 289.000 | Thời trang | SEDSP Fashion |
| `giay-chay-bo-airflex-marathon` / p4 | Giày chạy bộ AirFlex Marathon | 1.490.000 | Thể thao | SEDSP Sport |
| p5 | Sách "Hệ thống hỗ trợ quyết định" | 185.000 | Sách | SEDSP Books |
| p6 | Máy lọc không khí SmartAir H13 | 4.590.000 | Gia dụng | SEDSP Tech Mall |
| p7 | Chuột gaming không dây X-Pro | 890.000 | Điện tử | SEDSP Tech Mall |
| p8 | Balo laptop chống nước 15.6" | 450.000 | Phụ kiện | SEDSP Accessories |
| `noi-chien-khong-dau-5l` / p9 | Nồi chiên không dầu 5L | 1.290.000 | Gia dụng | SEDSP Tech Mall |
| p10 | Kính râm polarized UV400 | 320.000 | Thời trang | SEDSP Fashion |

### 2.2 Danh mục seed dev

- **V24:** Điện tử, Thể thao, Gia dụng  
- **V25:** Thời trang, Sách, Phụ kiện  

### 2.3 Đơn hàng mock (frontend `seedOrders`)

| ID | Khách | SP | Trạng thái | Tổng |
|----|-------|-----|------------|------|
| o1 | customer@sedsp.vn | Tai nghe ANC ×1 | delivered | 1.890.000đ |
| o2 | customer@sedsp.vn | Áo thun ×2 | shipping | 578.000đ |

---

## 3. Tier B — Capstone catalog `@secdsp.com`

**Migration:** `V27` (users + 50 SP), `V28` (ảnh + tồn), `V29` (cart/order/review), `V41` (review VI), `V56` (Việt hóa tên SP)

### 3.1 Mật khẩu theo role

| Role | Email mẫu | Password |
|------|-----------|----------|
| Admin | `admin01@secdsp.com` … `admin04@secdsp.com` | `Admin@123` |
| Manager | `manager01@secdsp.com` … `manager03@secdsp.com` | `Manager@123` |
| Seller | `seller01@secdsp.com` … `seller10@secdsp.com` | `Seller@123` |
| Customer | `customer01@gmail.com` … `customer10@gmail.com` | `Customer@123` |

### 3.2 Sellers & shop (V27)

| Email | Tên / Shop |
|-------|------------|
| seller01@secdsp.com | Nguyen Tech |
| seller02@secdsp.com | Minh Electronics |
| seller03@secdsp.com | Lan Fashion |
| seller04@secdsp.com | Beauty Hub |
| seller05@secdsp.com | HomeStyle |
| seller06@secdsp.com | Sport Max |
| seller07@secdsp.com | Digital World |
| seller08@secdsp.com | Urban Wear |
| seller09@secdsp.com | Kitchen Pro |

### 3.3 Cây danh mục chính (19 danh mục)

Điện thoại · Laptop · Tablet · Phụ kiện điện tử · Nam · Nữ · Giày · Skincare · Makeup · Nội thất · Trang trí · Nhà bếp · Fitness · Outdoor · …

### 3.4 50 sản phẩm capstone (slug → giá VNĐ)

**seller01 — Nguyen Tech**

| Slug | Tên | Giá |
|------|-----|-----|
| iphone-15-pro-128gb | iPhone 15 Pro 128GB | 29.990.000 |
| samsung-galaxy-s24 | Samsung Galaxy S24 | 24.990.000 |
| macbook-air-m3 | MacBook Air M3 | 32.990.000 |
| airpods-pro-2 | AirPods Pro 2 | 5.990.000 |
| ipad-air-6 | iPad Air 6 | 18.990.000 |

**seller02 — Minh Electronics**

| Slug | Tên | Giá |
|------|-----|-----|
| dell-xps-15 | Dell XPS 15 | 38.990.000 |
| hp-spectre-x360 | HP Spectre x360 | 35.990.000 |
| xiaomi-14-ultra | Xiaomi 14 Ultra | 21.990.000 |
| logitech-mx-master-3s | Logitech MX Master 3S | 2.990.000 |
| samsung-t7-ssd-1tb | Samsung T7 SSD 1TB | 3.490.000 |

**seller03 — Lan Fashion:** men-slim-fit-blazer (1.290.000), men-casual-shirt (499.000), women-floral-dress (899.000), women-office-skirt (699.000), leather-oxford-shoes (1.590.000)

**seller04 — Beauty Hub:** centella-facial-cleanser, vitamin-c-serum-30ml, matte-lipstick-set, hyaluronic-acid-serum, cushion-foundation (299k–529k)

**seller05 — HomeStyle:** modern-sofa-3-seater (15.990.000), wooden-dining-table (10.990.000), wall-art-canvas, non-stick-cookware-set, led-standing-lamp

**seller06 — Sport Max:** adjustable-dumbbell-20kg, yoga-mat-premium, treadmill-pro-x (12.990.000), camping-tent-4-person, hiking-backpack-40l

**seller07 — Digital World:** google-pixel-9, galaxy-tab-s9, anker-65w-charger, oneplus-12, wireless-charging-pad

**seller08 — Urban Wear:** oversized-hoodie, high-waist-jeans, sneakers-street-pro, graphic-tshirt, crop-top-basic

**seller09 — Kitchen Pro:** air-fryer-5l, blender-1000w, electric-kettle-18l (499.000), ceramic-vase-decor, wall-clock-modern

### 3.5 Showcase orders (V29)

6 đơn mẫu: **DELIVERED**, **SHIPPING**, **PROCESSING**, **CANCELLED**, **DELIVERED**, **PAID** — kèm MOMO/VNPAY, tracking, 7 review ban đầu (V41 bổ sung ~70 review tiếng Việt).

3 giỏ hàng + 2 wishlist (customer01–03).

---

## 4. Tier C — DSS demo `@example.com`

**Migration:** `V43`, `V46`, `V36`, `V39` · **Password:** `password` (V45 restore — không dùng `12345678`)

| Role | Email | Password |
|------|-------|----------|
| Seller DSS chính | `seller.dss.demo@example.com` | `password` |
| Seller phụ | `seller.dss.demo.2@example.com` … `.4@example.com` | `password` |
| Customer DSS | `customer.dss.demo.1@example.com` … `.12@example.com` | `password` |

**Frontend:** chip **Seller DSS** trên login (`mockData.ts` → `DSS_DEMO_SELLER_EMAIL`).

### 4.1 Sản phẩm DSS (`dss-demo-*`)

| Slug | Tên | Giá |
|------|-----|-----|
| dss-demo-wireless-mouse-pro | Wireless Mouse Pro | 350.000 |
| dss-demo-mechanical-keyboard-k87 | Mechanical Keyboard K87 | 1.290.000 |
| dss-demo-noise-cancelling-headphones | Noise Cancelling Headphones | 1.890.000 |
| dss-demo-usb-c-hub-8-in-1 | USB-C Hub 8-in-1 | 990.000 |
| dss-demo-urban-travel-backpack | Urban Travel Backpack | 750.000 |
| dss-demo-premium-cotton-jacket | Premium Cotton Jacket | 1.450.000 |
| dss-demo-running-shoes-x1 | Running Shoes X1 | 1.650.000 |
| dss-demo-fitness-smart-watch | Fitness Smart Watch | 2.490.000 |
| dss-demo-digital-coffee-maker | Digital Coffee Maker | 1.750.000 |
| dss-demo-smart-air-fryer | Smart Air Fryer | 2.200.000 |

**Lịch sử bán:** 30–121 ngày DELIVERED (marker `TXN_DSS30_SEED`, `TXN_DSS39_MULTI`, `[DSS-OWNER-DEMO]`) — phục vụ demand forecast, price history, what-if.

---

## 5. Voucher demo (V52)

| Mã | Loại | Giảm | Điều kiện | Phạm vi |
|----|------|------|-----------|---------|
| **SEDSP10** | % | 10% (max 100.000đ) | Đơn tối thiểu 200.000đ | Toàn sàn (PLATFORM) |
| **SHOP50K** | Cố định | 50.000đ | Đơn tối thiểu 300.000đ | Shop `seller@sedsp.vn` |

**Demo checkout:** login `customer@sedsp.vn` → thêm SP → **Thanh toán** → nhập `SEDSP10` hoặc `SHOP50K`.

---

## 6. Kịch bản demo gợi ý (5–10 phút)

### 6.1 Khách mua hàng + chatbot

1. Login `customer@sedsp.vn` / `12345678`  
2. **Cửa hàng** → tìm "tai nghe" hoặc chip **Điện thoại có gì?**  
3. Mở **Chat** → "Web bán gì vậy?" (insight catalog, không dump list)  
4. Thêm SP vào giỏ → voucher `SEDSP10`  
5. **Đơn hàng của tôi** → xem trạng thái  

### 6.2 Seller vận hành

1. Login `seller@sedsp.vn` / `12345678`  
2. **Quản lý SP** → tồn kho  
3. Chat: "doanh thu", "SKU sắp hết", "what-if giảm 10%"  
4. **DSS** → demand / price / inventory  

### 6.3 Manager

1. Login `manager@sedsp.vn` / `12345678`  
2. Dashboard KPI · voucher **SEDSP10**  
3. Chat: "KPI tháng này", "đơn chờ"  

### 6.4 DSS sâu (capstone slide)

1. Login `seller.dss.demo@example.com` / `password`  
2. **/seller/dss/** → demand, price recommendation, what-if  
3. So sánh biểu đồ 121 ngày vs seller Tier A  

---

## 7. Migration index (tra cứu nhanh)

| File | Nội dung seed |
|------|----------------|
| V2 | Roles: ADMIN, MANAGER, SELLER, CUSTOMER |
| V24 | 4 user sedsp.vn + 4 SP dev + inventory |
| V25 | +3 danh mục marketplace |
| V27 | 27 user secdsp.com + 50 SP |
| V28 | 150 ảnh SP + inventory 80–160 |
| V29 | attributes, cart, 6 orders, reviews, wishlist |
| V36, V39 | Lịch sử bán DSS 30–45 ngày |
| V41 | ~70 review tiếng Việt |
| V43, V46 | Identity + SP + 121 ngày sales DSS |
| V47, V48 | Việt hóa label, backfill tồn |
| V52 | Voucher SEDSP10, SHOP50K |
| V56 | Việt hóa tên/mô tả SP (giữ slug) |

**Export đầy đủ DB:** Admin → `GET /api/v1/admin/seed-data/download` → `sedsp_seed.sql`

---

## 8. Xung đột thường gặp — đọc trước khi demo

1. **`12345678` vs `123456`:** Backend Railway dùng `12345678`; mock localStorage dùng `123456`.  
2. **`@sedsp.vn` vs `@secdsp.com`:** UI demo = sedsp.vn; catalog lớn = secdsp.com.  
3. **DSS luôn `password`:** Không dùng `12345678` cho `@example.com`.  
4. **Tên SP sau V56:** Hiển thị tiếng Việt trên UI; slug SQL vẫn tiếng Anh.

---

## 9. Chatbot — câu hỏi demo nhanh

| Role | Câu mẫu |
|------|---------|
| Guest/Customer | "Web bán gì vậy?", "Điện thoại có gì?", "Dưới 2 triệu", "So sánh 2 sản phẩm" |
| Customer | "Giỏ hàng", "Đơn gần nhất", "Chỗ nào bán laptop" |
| Seller | "Doanh thu tháng này", "SP bán chạy", "What-if giảm 10%" |
| Manager | "KPI tháng này", "Đơn chờ xử lý" |

Demo login gợi ý trong chat: **customer@sedsp.vn** / **12345678**

---

*Tài liệu này đồng bộ với repo capstone — Smart E-Commerce Decision Support Platform (SEDSP).*
