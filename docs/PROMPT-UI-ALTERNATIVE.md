# Prompt so sánh UI — dùng với Claude

Copy toàn bộ khối dưới đây vào Claude (hoặc ChatGPT). Yêu cầu output là **một project Vue 3 riêng** để so sánh với UI hiện tại trong `smart-ecommerce-dssp-frontend`.

---

## PROMPT (copy từ đây)

```
Bạn là senior UI/UX engineer + Vue 3 developer. Hãy tạo một frontend HOÀN CHỈNH (có thể chạy được) cho dự án capstone sau — đây là bản UI THAY THẾ để team so sánh với bản hiện tại, KHÔNG sửa repo cũ.

### Dự án
**SEDSP** — Smart E-Commerce Decision Support Platform  
Nền tảng thương mại điện tử tích hợp Decision Support System (DSS) và AI.  
Backend (repo khác): Spring Boot + PostgreSQL + JWT + RBAC — chưa có API, FE dùng mock trước.

### Tech stack (bắt buộc)
- Vue 3 + TypeScript + Vite
- Vue Router + Pinia
- Không dùng UI framework có sẵn (không Vuetify, Element Plus, Naive UI, Ant Design Vue)
- CSS thuần hoặc scoped CSS modules — design system tự định nghĩa
- Chart: Chart.js hoặc chỉ CSS cho dashboard demo

### Yêu cầu thẩm mỹ — PHẢI KHÁC bản teal/Jakarta hiện tại
Chọn **một hướng visual rõ ràng** (ghi rõ trong README):
- Ví dụ A: Dark mode commerce (nền #0f1419, accent amber/coral)
- Ví dụ B: Editorial minimal (trắng, typography serif + sans, đen/xám)
- Ví dụ C: B2B SaaS (sidebar cố định, indigo/violet, dense tables)
- Ví dụ D: Neo-brutalism (viền đậm, shadow cứng, màu tươi)

Font: dùng Google Fonts KHÁC Plus Jakarta Sans (ví dụ: Inter, Outfit, Sora, DM Sans).

### Phạm vi chức năng (đủ theo SRS — mock localStorage)

**GUEST:** Register, Product list (filter), Product detail, Search

**CUSTOMER:** Login (JWT mock), Profile view/update, Cart (add/update), Checkout, Order history, Order detail + track status, AI recommendations, Customer chatbot

**SELLER:** Product CRUD + soft delete, price update, inventory view/update, sales dashboard, DSS (demand forecast, price recommendation, inventory recommendation, what-if), Seller assistant chatbot

**MANAGER:** Business KPI dashboard, Revenue analysis, Product trends, Customer behavior, DSS predictive insights, Scenario evaluation

**ADMIN:** User CRUD/search, activate/deactivate, assign roles, system monitoring (logs/metrics)

### Cấu trúc thư mục
```
sedsp-ui-alternative/
├── README.md          (hướng dẫn chạy + mô tả design direction + so sánh với bản teal)
├── package.json
├── vite.config.ts     (proxy /api → localhost:8080)
├── .env.example       (VITE_USE_MOCK=true, VITE_API_BASE_URL=/api)
└── src/
    ├── api/           (mock + http client chuẩn { success, message, data })
    ├── components/
    ├── views/         (theo role như trên)
    ├── router/        (RBAC guard)
    └── stores/
```

### Tài khoản demo
Mật khẩu: `123456`
- customer@sedsp.vn
- seller@sedsp.vn
- manager@sedsp.vn
- admin@sedsp.vn

### UX chuyên nghiệp (bắt buộc có)
- Responsive (mobile nav)
- Loading / empty states
- Page transitions hoặc micro-interaction nhẹ
- Form validation feedback
- Order status badges có màu semantic
- Dashboard có stat cards + ít nhất 1 chart
- Auth: layout đẹp (split hoặc centered card)
- Accessibility: label form, focus ring, contrast đủ

### Tích hợp backend (chuẩn bị sẵn, chưa cần API thật)
- `src/api/http/client.ts` — Bearer token, unwrap ApiResponse
- `src/api/http/paths.ts` — map endpoint Spring Boot modules
- `VITE_USE_MOCK=true` mặc định

### Deliverable
1. Toàn bộ source code có thể `npm install && npm run dev`
2. README có section **"So sánh với SEDSP UI hiện tại"** (3–5 bullet: màu, layout, navigation, typography, đối tượng phù hợp)
3. Không placeholder "lorem ipsum" cho tên sản phẩm — dùng data tiếng Việt thực tế

### Giới hạn
- Không cần test unit
- Không cần Docker
- Code sạch, component tái sử dụng, không copy y nguyên layout teal/hero gradient của bản cũ

Bắt đầu bằng cách nêu design direction bạn chọn, rồi implement đầy đủ.
```

---

## Cách so sánh 2 bản UI

| Tiêu chí | Bản hiện tại (`smart-ecommerce-dssp-frontend`) | Bản Claude (`sedsp-ui-alternative`) |
|----------|-----------------------------------------------|-------------------------------------|
| Visual | Teal / Plus Jakarta / hero gradient | (tùy direction Claude chọn) |
| Nav | Top sticky, mobile hamburger | (có thể sidebar B2B) |
| Chạy | `npm run dev` port 5173 | đặt port 5174 nếu chạy song song |

```bash
# Terminal 1 — UI hiện tại
cd smart-ecommerce-dssp-frontend && npm run dev

# Terminal 2 — UI Claude (sau khi generate)
cd sedsp-ui-alternative && npm run dev -- --port 5174
```

## Gợi ý khi review với team

- Cùng mock data → so sánh công bằng flow, không phải API
- Chọn 3 màn: Login, Product list, Manager dashboard
- Vote: dễ dùng / chuyên nghiệp / phù hợp capstone demo / mobile
