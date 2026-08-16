# SEDSP — Demo Script (Seed SQL Reference)

> **Nguồn:** Flyway migrations `backend/src/main/resources/db/migration/`  
> **Mục đích:** Tra cứu lệnh SQL đã dùng để seed dữ liệu demo.

---

## Roles & Access Control

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- ROLES & ACCESS CONTROL
-- File: V2__create_roles_table.sql
-- ============================================

INSERT INTO roles (name, description)
VALUES ('ADMIN', 'System Administrator'),
       ('MANAGER', 'Business Manager'),
       ('SELLER', 'Product Seller'),
       ('CUSTOMER', 'Customer User');
```

---

## Dev Seed — Users & Catalog

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- DEV USERS, CATEGORIES, PRODUCTS, INVENTORY
-- File: V24__seed_dev_data.sql
-- Password (plain): 12345678 — hash via pgcrypto crypt()
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. INSERT DEV USERS (@sedsp.vn)
INSERT INTO users (username, email, password, full_name, phone, status, role_id)
SELECT 'customer', 'customer@sedsp.vn',
       crypt('12345678', gen_salt('bf', 10)),
       'Nguyễn Văn Khách', '0901234567', 'ACTIVE'::user_status, r.id
FROM roles r WHERE r.name = 'CUSTOMER'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = 'customer@sedsp.vn');

INSERT INTO users (username, email, password, full_name, phone, status, role_id, store_name)
SELECT 'seller', 'seller@sedsp.vn',
       crypt('12345678', gen_salt('bf', 10)),
       'Trần Thị Bán', '0912345678', 'ACTIVE'::user_status, r.id, 'SEDSP Official'
FROM roles r WHERE r.name = 'SELLER'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = 'seller@sedsp.vn');

INSERT INTO users (username, email, password, full_name, status, role_id)
SELECT 'manager', 'manager@sedsp.vn',
       crypt('12345678', gen_salt('bf', 10)),
       'Lê Văn Quản', 'ACTIVE'::user_status, r.id
FROM roles r WHERE r.name = 'MANAGER'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = 'manager@sedsp.vn');

INSERT INTO users (username, email, password, full_name, status, role_id)
SELECT 'admin', 'admin@sedsp.vn',
       crypt('12345678', gen_salt('bf', 10)),
       'Phạm Admin', 'ACTIVE'::user_status, r.id
FROM roles r WHERE r.name = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = 'admin@sedsp.vn');

-- 2. INSERT CATEGORIES (dev)
INSERT INTO categories (name, slug)
SELECT 'Điện tử', 'dien-tu'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'dien-tu' AND deleted_at IS NULL);

INSERT INTO categories (name, slug)
SELECT 'Thể thao', 'the-thao'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'the-thao' AND deleted_at IS NULL);

INSERT INTO categories (name, slug)
SELECT 'Gia dụng', 'gia-dung'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'gia-dung' AND deleted_at IS NULL);

-- 3. INSERT PRODUCTS + IMAGES + INVENTORY (seller@sedsp.vn)
INSERT INTO products (seller_id, category_id, name, slug, description, price, cost_price, status)
SELECT u.id, c.id,
       'Tai nghe Bluetooth Pro ANC', 'tai-nghe-bluetooth-pro-anc',
       'Tai nghe chống ồn chủ động, pin 30 giờ.', 1890000, 1200000, 'ACTIVE'::product_status
FROM users u JOIN categories c ON c.slug = 'dien-tu'
WHERE u.email = 'seller@sedsp.vn'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = 'tai-nghe-bluetooth-pro-anc' AND p.deleted_at IS NULL);

INSERT INTO product_images (product_id, image_url, public_id, is_primary)
SELECT p.id, 'https://picsum.photos/seed/p1/400/400', 'secdsp/products/tai-nghe-bluetooth-pro-anc', TRUE
FROM products p WHERE p.slug = 'tai-nghe-bluetooth-pro-anc'
  AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id AND pi.deleted_at IS NULL);

INSERT INTO inventory (product_id, available_quantity, reserved_quantity)
SELECT p.id, 45, 0 FROM products p WHERE p.slug = 'tai-nghe-bluetooth-pro-anc'
  AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id);

-- (Tương tự V24: ban-phim-co-rgb-keypro-k87, giay-chay-bo-airflex-marathon, noi-chien-khong-dau-5l)
```

---

## Marketplace Categories

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- MARKETPLACE CATEGORIES (FE sync)
-- File: V25__seed_marketplace_categories.sql
-- ============================================

INSERT INTO categories (name, slug, parent_id, created_at, updated_at)
SELECT v.name, v.slug, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
    ('Thời trang', 'thoi-trang'),
    ('Sách', 'sach'),
    ('Phụ kiện', 'phu-kien')
) AS v(name, slug)
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.slug = v.slug AND c.deleted_at IS NULL
);
```

---

## Capstone Demo Catalog — Users

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- CAPSTONE USERS (@secdsp.com / @gmail.com)
-- File: V27__seed_capstone_demo_catalog.sql
-- Passwords: Admin@123 | Manager@123 | Seller@123 | Customer@123
-- ============================================

-- 1. INSERT ADMINS
INSERT INTO users (username, email, password, full_name, phone, status, role_id)
SELECT v.username, v.email, v.pw_hash, v.full_name, v.phone,
       'ACTIVE'::user_status, r.id
FROM (VALUES
    ('admin01', 'admin01@secdsp.com', '$2b$10$.6CytaAUMzHCV8qIzrQJHeL1uq2xZSWIz3sl7lt4H0YdUu0lqbXzq', 'System Admin 01', '0901000001'),
    ('admin02', 'admin02@secdsp.com', '$2b$10$.6CytaAUMzHCV8qIzrQJHeL1uq2xZSWIz3sl7lt4H0YdUu0lqbXzq', 'System Admin 02', '0901000002'),
    ('admin03', 'admin03@secdsp.com', '$2b$10$.6CytaAUMzHCV8qIzrQJHeL1uq2xZSWIz3sl7lt4H0YdUu0lqbXzq', 'System Admin 03', '0901000003'),
    ('admin04', 'admin04@secdsp.com', '$2b$10$.6CytaAUMzHCV8qIzrQJHeL1uq2xZSWIz3sl7lt4H0YdUu0lqbXzq', 'System Admin 04', '0901000004')
) AS v(username, email, pw_hash, full_name, phone)
JOIN roles r ON r.name = 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = v.email);

-- 2. INSERT MANAGERS
INSERT INTO users (username, email, password, full_name, phone, status, role_id)
SELECT v.username, v.email, v.pw_hash, v.full_name, v.phone,
       'ACTIVE'::user_status, r.id
FROM (VALUES
    ('manager01', 'manager01@secdsp.com', '$2b$10$VYxA7/aejRwwabARc8oWNuM0FK90DP/GwCLS5UUUiCzYshx11RF7C', 'Business Manager 01', '0902000001'),
    ('manager02', 'manager02@secdsp.com', '$2b$10$VYxA7/aejRwwabARc8oWNuM0FK90DP/GwCLS5UUUiCzYshx11RF7C', 'Business Manager 02', '0902000002'),
    ('manager03', 'manager03@secdsp.com', '$2b$10$VYxA7/aejRwwabARc8oWNuM0FK90DP/GwCLS5UUUiCzYshx11RF7C', 'Business Manager 03', '0902000003')
) AS v(username, email, pw_hash, full_name, phone)
JOIN roles r ON r.name = 'MANAGER'
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = v.email);

-- 3. INSERT SELLERS (10 shops)
INSERT INTO users (username, email, password, full_name, phone, status, role_id,
                   store_name, business_email, business_phone, seller_description)
SELECT v.username, v.email, v.pw_hash, v.full_name, v.phone,
       'ACTIVE'::user_status, r.id,
       v.store_name, v.business_email, v.business_phone, v.seller_description
FROM (VALUES
    ('seller01', 'seller01@secdsp.com', '$2b$10$aqSXDEnhGzZYNf3ibiPHeeKAeqP/F6h/qEGg.XED/B4jd7dtxDEvi', 'Nguyen Tech', '0903000001',
     'NT Tech Store', 'contact@nttech.vn', '0903888001', 'Chuyên thiết bị điện tử chính hãng'),
    ('seller02', 'seller02@secdsp.com', '$2b$10$aqSXDEnhGzZYNf3ibiPHeeKAeqP/F6h/qEGg.XED/B4jd7dtxDEvi', 'Minh Electronics', '0903000002',
     'Minh Electronics', 'support@minhelec.vn', '0903888002', 'Laptop và phụ kiện cao cấp'),
    ('seller03', 'seller03@secdsp.com', '$2b$10$aqSXDEnhGzZYNf3ibiPHeeKAeqP/F6h/qEGg.XED/B4jd7dtxDEvi', 'Lan Fashion', '0903000003',
     'Lan Fashion House', 'contact@lanfashion.vn', '0903888003', 'Thời trang nam nữ hiện đại'),
    ('seller04', 'seller04@secdsp.com', '$2b$10$aqSXDEnhGzZYNf3ibiPHeeKAeqP/F6h/qEGg.XED/B4jd7dtxDEvi', 'Beauty Hub', '0903000004',
     'Beauty Hub', 'care@beautyhub.vn', '0903888004', 'Mỹ phẩm chính hãng Hàn Quốc'),
    ('seller05', 'seller05@secdsp.com', '$2b$10$aqSXDEnhGzZYNf3ibiPHeeKAeqP/F6h/qEGg.XED/B4jd7dtxDEvi', 'HomeStyle', '0903000005',
     'HomeStyle Living', 'hello@homestyle.vn', '0903888005', 'Nội thất và trang trí nhà cửa'),
    ('seller06', 'seller06@secdsp.com', '$2b$10$aqSXDEnhGzZYNf3ibiPHeeKAeqP/F6h/qEGg.XED/B4jd7dtxDEvi', 'Sport Max', '0903000006',
     'Sport Max Store', 'contact@sportmax.vn', '0903888006', 'Dụng cụ thể thao chuyên nghiệp'),
    ('seller07', 'seller07@secdsp.com', '$2b$10$aqSXDEnhGzZYNf3ibiPHeeKAeqP/F6h/qEGg.XED/B4jd7dtxDEvi', 'Digital World', '0903000007',
     'Digital World', 'support@digitalworld.vn', '0903888007', 'Điện thoại và tablet mới nhất'),
    ('seller08', 'seller08@secdsp.com', '$2b$10$aqSXDEnhGzZYNf3ibiPHeeKAeqP/F6h/qEGg.XED/B4jd7dtxDEvi', 'Urban Wear', '0903000008',
     'Urban Wear', 'contact@urbanwear.vn', '0903888008', 'Thời trang street style'),
    ('seller09', 'seller09@secdsp.com', '$2b$10$aqSXDEnhGzZYNf3ibiPHeeKAeqP/F6h/qEGg.XED/B4jd7dtxDEvi', 'Kitchen Pro', '0903000009',
     'Kitchen Pro', 'support@kitchenpro.vn', '0903888009', 'Thiết bị nhà bếp cao cấp'),
    ('seller10', 'seller10@secdsp.com', '$2b$10$aqSXDEnhGzZYNf3ibiPHeeKAeqP/F6h/qEGg.XED/B4jd7dtxDEvi', 'Outdoor Life', '0903000010',
     'Outdoor Life', 'hello@outdoorlife.vn', '0903888010', 'Dụng cụ dã ngoại và outdoor gear')
) AS v(username, email, pw_hash, full_name, phone, store_name, business_email, business_phone, seller_description)
JOIN roles r ON r.name = 'SELLER'
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = v.email);

-- 4. INSERT CUSTOMERS
INSERT INTO users (username, email, password, full_name, phone, status, role_id)
SELECT v.username, v.email, v.pw_hash, v.full_name, v.phone,
       'ACTIVE'::user_status, r.id
FROM (VALUES
    ('customer01', 'customer01@gmail.com', '$2b$10$8k1kz.R67FCQv4uAiXGJZeSBBDR8qkh5CMbo9eUY63zcF9CMXqP/q', 'Tran Van A', '0910000001'),
    ('customer02', 'customer02@gmail.com', '$2b$10$8k1kz.R67FCQv4uAiXGJZeSBBDR8qkh5CMbo9eUY63zcF9CMXqP/q', 'Le Thi B', '0910000002'),
    ('customer03', 'customer03@gmail.com', '$2b$10$8k1kz.R67FCQv4uAiXGJZeSBBDR8qkh5CMbo9eUY63zcF9CMXqP/q', 'Pham Van C', '0910000003'),
    ('customer04', 'customer04@gmail.com', '$2b$10$8k1kz.R67FCQv4uAiXGJZeSBBDR8qkh5CMbo9eUY63zcF9CMXqP/q', 'Nguyen Thi D', '0910000004'),
    ('customer05', 'customer05@gmail.com', '$2b$10$8k1kz.R67FCQv4uAiXGJZeSBBDR8qkh5CMbo9eUY63zcF9CMXqP/q', 'Hoang Van E', '0910000005'),
    ('customer06', 'customer06@gmail.com', '$2b$10$8k1kz.R67FCQv4uAiXGJZeSBBDR8qkh5CMbo9eUY63zcF9CMXqP/q', 'Vu Thi F', '0910000006'),
    ('customer07', 'customer07@gmail.com', '$2b$10$8k1kz.R67FCQv4uAiXGJZeSBBDR8qkh5CMbo9eUY63zcF9CMXqP/q', 'Dang Van G', '0910000007'),
    ('customer08', 'customer08@gmail.com', '$2b$10$8k1kz.R67FCQv4uAiXGJZeSBBDR8qkh5CMbo9eUY63zcF9CMXqP/q', 'Bui Thi H', '0910000008'),
    ('customer09', 'customer09@gmail.com', '$2b$10$8k1kz.R67FCQv4uAiXGJZeSBBDR8qkh5CMbo9eUY63zcF9CMXqP/q', 'Ly Van I', '0910000009'),
    ('customer10', 'customer10@gmail.com', '$2b$10$8k1kz.R67FCQv4uAiXGJZeSBBDR8qkh5CMbo9eUY63zcF9CMXqP/q', 'Do Thi K', '0910000010')
) AS v(username, email, pw_hash, full_name, phone)
JOIN roles r ON r.name = 'CUSTOMER'
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = v.email);
```

---

## Capstone Demo Catalog — Categories & Products

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- CAPSTONE CATEGORIES (multi-level) + 50 PRODUCTS
-- File: V27__seed_capstone_demo_catalog.sql
-- ============================================

-- 1. INSERT ROOT CATEGORIES
INSERT INTO categories (name, slug)
SELECT v.name, v.slug
FROM (VALUES
    ('Electronics', 'electronics'),
    ('Fashion', 'fashion'),
    ('Beauty', 'beauty'),
    ('Home & Living', 'home-living'),
    ('Sports', 'sports')
) AS v(name, slug)
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = v.slug AND c.deleted_at IS NULL);

-- 2. INSERT CHILD CATEGORIES
INSERT INTO categories (name, slug, parent_id)
SELECT v.name, v.slug, p.id
FROM (VALUES
    ('Phones', 'phones', 'electronics'),
    ('Laptops', 'laptops', 'electronics'),
    ('Tablets', 'tablets', 'electronics'),
    ('Accessories', 'electronics-accessories', 'electronics'),
    ('Men Clothing', 'men-clothing', 'fashion'),
    ('Women Clothing', 'women-clothing', 'fashion'),
    ('Shoes', 'shoes', 'fashion'),
    ('Skincare', 'skincare', 'beauty'),
    ('Makeup', 'makeup', 'beauty'),
    ('Kitchen', 'kitchen', 'home-living'),
    ('Furniture', 'furniture', 'home-living'),
    ('Decor', 'decor', 'home-living'),
    ('Fitness Equipment', 'fitness-equipment', 'sports'),
    ('Outdoor Gear', 'outdoor-gear', 'sports')
) AS v(name, slug, parent_slug)
JOIN categories p ON p.slug = v.parent_slug AND p.deleted_at IS NULL
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = v.slug AND c.deleted_at IS NULL);

-- 3. INSERT 50 PRODUCTS
INSERT INTO products (seller_id, category_id, name, slug, description, price, cost_price, status)
SELECT s.id, c.id, v.name, v.slug, v.description, v.price, v.cost_price, 'ACTIVE'::product_status
FROM (VALUES
    ('seller01@secdsp.com', 'phones', 'iPhone 15 Pro 128GB', 'iphone-15-pro-128gb', 'Latest Apple smartphone with A17 chip', 29990000::numeric, 25000000::numeric),
    ('seller01@secdsp.com', 'phones', 'Samsung Galaxy S24', 'samsung-galaxy-s24', 'Flagship Samsung phone 2026 edition', 24990000, 21000000),
    ('seller01@secdsp.com', 'laptops', 'MacBook Air M3', 'macbook-air-m3', 'Lightweight laptop with Apple M3 chip', 32990000, 28000000),
    ('seller01@secdsp.com', 'electronics-accessories', 'AirPods Pro 2', 'airpods-pro-2', 'Wireless earbuds with noise cancelling', 5990000, 4500000),
    ('seller01@secdsp.com', 'tablets', 'iPad Air 6', 'ipad-air-6', 'Apple tablet for productivity and entertainment', 18990000, 15000000),
    ('seller02@secdsp.com', 'laptops', 'Dell XPS 15', 'dell-xps-15', 'Premium laptop for professionals', 38990000, 33000000),
    ('seller02@secdsp.com', 'laptops', 'HP Spectre x360', 'hp-spectre-x360', 'Convertible ultrabook high performance', 35990000, 30000000),
    ('seller02@secdsp.com', 'phones', 'Xiaomi 14 Ultra', 'xiaomi-14-ultra', 'High-end Xiaomi flagship phone', 21990000, 18000000),
    ('seller02@secdsp.com', 'electronics-accessories', 'Logitech MX Master 3S', 'logitech-mx-master-3s', 'Advanced wireless mouse', 2990000, 2200000),
    ('seller02@secdsp.com', 'electronics-accessories', 'Samsung T7 SSD 1TB', 'samsung-t7-ssd-1tb', 'Portable high speed SSD', 3490000, 2600000),
    ('seller03@secdsp.com', 'men-clothing', 'Men Slim Fit Blazer', 'men-slim-fit-blazer', 'Elegant slim fit blazer for men', 1290000, 900000),
    ('seller03@secdsp.com', 'men-clothing', 'Men Casual Shirt', 'men-casual-shirt', 'Comfortable cotton casual shirt', 499000, 320000),
    ('seller03@secdsp.com', 'women-clothing', 'Women Floral Dress', 'women-floral-dress', 'Summer floral dress', 899000, 600000),
    ('seller03@secdsp.com', 'women-clothing', 'Women Office Skirt', 'women-office-skirt', 'Professional office skirt', 699000, 450000),
    ('seller03@secdsp.com', 'shoes', 'Leather Oxford Shoes', 'leather-oxford-shoes', 'Classic leather shoes for men', 1590000, 1100000),
    ('seller04@secdsp.com', 'skincare', 'Centella Facial Cleanser', 'centella-facial-cleanser', 'Gentle facial cleanser', 299000, 180000),
    ('seller04@secdsp.com', 'skincare', 'Vitamin C Serum 30ml', 'vitamin-c-serum-30ml', 'Brightening vitamin C serum', 459000, 300000),
    ('seller04@secdsp.com', 'makeup', 'Matte Lipstick Set', 'matte-lipstick-set', 'Long lasting matte lipstick', 399000, 250000),
    ('seller04@secdsp.com', 'skincare', 'Hyaluronic Acid Serum', 'hyaluronic-acid-serum', 'Hydrating serum for all skin types', 499000, 320000),
    ('seller04@secdsp.com', 'makeup', 'Cushion Foundation', 'cushion-foundation', 'Lightweight cushion foundation', 529000, 350000),
    ('seller05@secdsp.com', 'furniture', 'Modern Sofa 3 Seater', 'modern-sofa-3-seater', 'Comfortable modern sofa', 15990000, 12000000),
    ('seller05@secdsp.com', 'furniture', 'Wooden Dining Table', 'wooden-dining-table', 'Solid wood dining table', 10990000, 8000000),
    ('seller05@secdsp.com', 'decor', 'Wall Art Canvas', 'wall-art-canvas', 'Minimalist wall decoration', 799000, 500000),
    ('seller05@secdsp.com', 'kitchen', 'Non-stick Cookware Set', 'non-stick-cookware-set', 'Premium kitchen cookware', 2499000, 1800000),
    ('seller05@secdsp.com', 'decor', 'LED Standing Lamp', 'led-standing-lamp', 'Decorative LED lamp', 1299000, 900000),
    ('seller06@secdsp.com', 'fitness-equipment', 'Adjustable Dumbbell 20kg', 'adjustable-dumbbell-20kg', 'Fitness dumbbell set', 1499000, 1100000),
    ('seller06@secdsp.com', 'fitness-equipment', 'Yoga Mat Premium', 'yoga-mat-premium', 'Non-slip yoga mat', 399000, 250000),
    ('seller06@secdsp.com', 'fitness-equipment', 'Treadmill Pro X', 'treadmill-pro-x', 'Electric treadmill for home use', 12990000, 10000000),
    ('seller06@secdsp.com', 'outdoor-gear', 'Camping Tent 4 Person', 'camping-tent-4-person', 'Waterproof outdoor tent', 2999000, 2200000),
    ('seller06@secdsp.com', 'outdoor-gear', 'Hiking Backpack 40L', 'hiking-backpack-40l', 'Durable hiking backpack', 999000, 700000),
    ('seller07@secdsp.com', 'phones', 'Google Pixel 9', 'google-pixel-9', 'Pure Android flagship phone', 22990000, 19000000),
    ('seller07@secdsp.com', 'tablets', 'Samsung Galaxy Tab S9', 'galaxy-tab-s9', 'High-end Android tablet', 19990000, 16000000),
    ('seller07@secdsp.com', 'electronics-accessories', 'Anker 65W Charger', 'anker-65w-charger', 'Fast charging adapter', 899000, 600000),
    ('seller07@secdsp.com', 'phones', 'OnePlus 12', 'oneplus-12', 'Flagship killer smartphone', 17990000, 14500000),
    ('seller07@secdsp.com', 'electronics-accessories', 'Wireless Charging Pad', 'wireless-charging-pad', 'Qi wireless charger', 599000, 400000),
    ('seller08@secdsp.com', 'men-clothing', 'Oversized Hoodie', 'oversized-hoodie', 'Street style hoodie', 699000, 450000),
    ('seller08@secdsp.com', 'women-clothing', 'High Waist Jeans', 'high-waist-jeans', 'Trendy women jeans', 899000, 600000),
    ('seller08@secdsp.com', 'shoes', 'Sneakers Street Pro', 'sneakers-street-pro', 'Comfortable street sneakers', 1299000, 900000),
    ('seller08@secdsp.com', 'men-clothing', 'Graphic T-Shirt', 'graphic-tshirt', 'Cotton printed t-shirt', 399000, 250000),
    ('seller08@secdsp.com', 'women-clothing', 'Crop Top Basic', 'crop-top-basic', 'Basic crop top', 299000, 180000),
    ('seller09@secdsp.com', 'kitchen', 'Air Fryer 5L', 'air-fryer-5l', 'Healthy oil-free cooking', 2499000, 1900000),
    ('seller09@secdsp.com', 'kitchen', 'Blender 1000W', 'blender-1000w', 'High power kitchen blender', 1599000, 1200000),
    ('seller09@secdsp.com', 'kitchen', 'Electric Kettle 1.8L', 'electric-kettle-18l', 'Fast boiling kettle', 499000, 350000),
    ('seller09@secdsp.com', 'decor', 'Ceramic Vase Decor', 'ceramic-vase-decor', 'Minimalist decor vase', 599000, 400000),
    ('seller09@secdsp.com', 'decor', 'Wall Clock Modern', 'wall-clock-modern', 'Modern style wall clock', 699000, 500000),
    ('seller10@secdsp.com', 'outdoor-gear', 'Sleeping Bag Winter', 'sleeping-bag-winter', 'Warm sleeping bag for camping', 1299000, 950000),
    ('seller10@secdsp.com', 'outdoor-gear', 'Portable Gas Stove', 'portable-gas-stove', 'Compact outdoor stove', 899000, 650000),
    ('seller10@secdsp.com', 'fitness-equipment', 'Resistance Band Set', 'resistance-band-set', 'Fitness resistance bands', 299000, 180000),
    ('seller10@secdsp.com', 'outdoor-gear', 'Camping Table Foldable', 'camping-table-foldable', 'Foldable outdoor table', 1499000, 1100000),
    ('seller10@secdsp.com', 'outdoor-gear', 'Outdoor Flashlight Pro', 'outdoor-flashlight-pro', 'High brightness flashlight', 499000, 300000)
) AS v(seller_email, cat_slug, name, slug, description, price, cost_price)
JOIN users s ON s.email = v.seller_email
JOIN categories c ON c.slug = v.cat_slug AND c.deleted_at IS NULL
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug AND p.deleted_at IS NULL);
```

---

## Product Images, Inventory & Price History

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- IMAGES (3 Unsplash/SP), INVENTORY, PRICE HISTORY
-- File: V28__seed_capstone_demo_images_inventory.sql
-- ============================================

-- 1. INSERT PRODUCT IMAGES (mỗi slug × 3 ảnh — tổng 150 rows)
INSERT INTO product_images (product_id, image_url, public_id, is_primary)
SELECT p.id, img.url, img.public_id, img.is_primary
FROM products p
JOIN (VALUES
    ('iphone-15-pro-128gb', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80', 'secdsp/products/iphone-15-pro-128gb-1', true),
    ('iphone-15-pro-128gb', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80', 'secdsp/products/iphone-15-pro-128gb-2', false),
    ('samsung-t7-ssd-1tb', 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80', 'secdsp/products/samsung-t7-ssd-1tb-1', true)
    -- ... (đủ 50 slug × 3 — xem file V28 đầy đủ)
) AS img(slug, url, public_id, is_primary) ON p.slug = img.slug
WHERE NOT EXISTS (
    SELECT 1 FROM product_images pi
    WHERE pi.product_id = p.id AND pi.public_id = img.public_id AND pi.deleted_at IS NULL
);

-- 2. INSERT INVENTORY (80–160 units / product)
INSERT INTO inventory (product_id, available_quantity, reserved_quantity)
SELECT p.id,
       80 + (MOD(hashtext(p.slug), 81))::int,
       MOD(hashtext(p.slug || 'r'), 5)::int
FROM products p
WHERE p.slug IN ('iphone-15-pro-128gb', 'samsung-galaxy-s24', /* ... 50 slugs */ 'outdoor-flashlight-pro')
  AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id);

-- 3. INSERT INITIAL PRICE HISTORY
INSERT INTO price_history (product_id, old_price, new_price, changed_by, reason, created_at)
SELECT p.id, NULL, p.price, a.id, 'Initial catalog price', NOW() - INTERVAL '90 days'
FROM products p
CROSS JOIN LATERAL (SELECT id FROM users WHERE email = 'admin01@secdsp.com' LIMIT 1) a
WHERE p.slug IN (SELECT slug FROM products WHERE deleted_at IS NULL LIMIT 50)
  AND NOT EXISTS (SELECT 1 FROM price_history ph WHERE ph.product_id = p.id AND ph.old_price IS NULL);
```

---

## Orders, Carts & Attributes

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- ATTRIBUTES, CARTS, ORDERS, PAYMENTS, TRACKING
-- File: V29__seed_capstone_demo_orders.sql
-- ============================================

-- 1. INSERT PRODUCT ATTRIBUTES (theo danh mục)
INSERT INTO product_attributes (product_id, attribute_name, attribute_value)
SELECT p.id, 'Brand',
       CASE
           WHEN p.name ILIKE '%iPhone%' OR p.name ILIKE '%MacBook%' THEN 'Apple'
           WHEN p.name ILIKE '%Samsung%' OR p.name ILIKE '%Galaxy%' THEN 'Samsung'
           WHEN p.name ILIKE '%Dell%' THEN 'Dell'
           ELSE 'Generic'
       END
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE c.slug IN ('phones', 'laptops', 'tablets')
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM product_attributes pa
      WHERE pa.product_id = p.id AND pa.attribute_name = 'Brand' AND pa.deleted_at IS NULL
  );

-- 2. INSERT CARTS + CART ITEMS
INSERT INTO carts (user_id)
SELECT u.id FROM users u
WHERE u.email IN ('customer01@gmail.com', 'customer02@gmail.com', 'customer03@gmail.com')
  AND NOT EXISTS (SELECT 1 FROM carts c WHERE c.user_id = u.id AND c.deleted_at IS NULL);

INSERT INTO cart_items (cart_id, product_id, quantity)
SELECT c.id, p.id, v.qty
FROM (VALUES
    ('customer01@gmail.com', 'iphone-15-pro-128gb', 1),
    ('customer01@gmail.com', 'men-slim-fit-blazer', 2),
    ('customer02@gmail.com', 'dell-xps-15', 1),
    ('customer02@gmail.com', 'modern-sofa-3-seater', 1),
    ('customer03@gmail.com', 'adjustable-dumbbell-20kg', 1),
    ('customer03@gmail.com', 'google-pixel-9', 1)
) AS v(email, slug, qty)
JOIN users u ON u.email = v.email
JOIN carts c ON c.user_id = u.id AND c.deleted_at IS NULL
JOIN products p ON p.slug = v.slug AND p.deleted_at IS NULL
WHERE NOT EXISTS (
    SELECT 1 FROM cart_items ci
    WHERE ci.cart_id = c.id AND ci.product_id = p.id AND ci.deleted_at IS NULL
);

-- 3. INSERT SHOWCASE ORDERS (6 đơn — PL/pgSQL block)
-- Marker: payments.transaction_id = TXN0001 … TXN0006
-- ORDER 1 DELIVERED — customer01: iPhone + Blazer — MOMO TXN0001
INSERT INTO orders (user_id, subtotal_amount, shipping_fee, discount_amount, total_amount, status, shipping_address)
VALUES (/* c1 */, 32570000, 50000, 0, 32620000, 'DELIVERED'::order_status, '123 Nguyen Trai, Ho Chi Minh City');

INSERT INTO order_items (order_id, product_id, seller_id, product_name_at_purchase, quantity, unit_price_at_purchase, subtotal)
VALUES
    (/* o1 */, /* p_iphone */, /* s_nt */, 'iPhone 15 Pro 128GB', 1, 29990000, 29990000),
    (/* o1 */, /* p_blazer */, /* s_lan */, 'Men Slim Fit Blazer', 2, 1290000, 2580000);

INSERT INTO payments (order_id, payment_method, amount, status, transaction_id, paid_at)
VALUES (/* o1 */, 'MOMO'::payment_method_enum, 32620000, 'SUCCESS'::payment_status, 'TXN0001', NOW());

INSERT INTO order_tracking (order_id, event, updated_by) VALUES
    (/* o1 */, 'CREATED'::order_tracking_event, /* c1 */),
    (/* o1 */, 'PAYMENT_SUCCESS'::order_tracking_event, /* c1 */),
    (/* o1 */, 'CONFIRMED'::order_tracking_event, /* s_nt */),
    (/* o1 */, 'SHIPPED'::order_tracking_event, /* s_nt */),
    (/* o1 */, 'DELIVERED'::order_tracking_event, /* s_nt */);

-- ORDER 2 SHIPPING — TXN0002 | ORDER 3 PROCESSING — TXN0003
-- ORDER 4 CANCELLED — TXN0004 | ORDER 5 DELIVERED — TXN0005 | ORDER 6 PAID — TXN0006
-- (Chi tiết đầy đủ trong V29 — kèm inventory_logs trừ tồn)
```

---

## Product Reviews

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- PRODUCT REVIEWS (tiếng Việt)
-- File: V41__seed_product_reviews.sql
-- ============================================

-- 1. UPDATE review V29 sang tiếng Việt
UPDATE product_reviews pr
SET comment = v.comment, updated_at = CURRENT_TIMESTAMP
FROM (VALUES
    ('customer01@gmail.com', 'iphone-15-pro-128gb',
     'Máy mượt, camera đêm rõ. Giao hàng đúng hẹn, đóng gói chắc chắn.'),
    ('customer02@gmail.com', 'modern-sofa-3-seater',
     'Nệm êm, vải dễ lau. Ship lắp đặt đúng hẹn.'),
    ('customer03@gmail.com', 'google-pixel-9',
     'Ảnh tự nhiên, cập nhật Android sạch. Pin đủ ngày.')
) AS v(email, slug, comment)
JOIN users u ON u.email = v.email
JOIN products p ON p.slug = v.slug AND p.deleted_at IS NULL
WHERE pr.user_id = u.id AND pr.product_id = p.id AND pr.deleted_at IS NULL;

-- 2. INSERT thêm ~70 review mẫu
INSERT INTO product_reviews (product_id, user_id, rating, comment, created_at, updated_at)
SELECT p.id, u.id, v.rating, v.comment,
       CURRENT_TIMESTAMP - (v.days_ago || ' days')::interval,
       CURRENT_TIMESTAMP - (v.days_ago || ' days')::interval
FROM (VALUES
    ('customer02@gmail.com', 'iphone-15-pro-128gb', 4,
     'Pin ổn trong ngày. Giá hơi cao nhưng đúng chuẩn hàng chính hãng.', 8),
    ('customer04@gmail.com', 'samsung-t7-ssd-1tb', 5,
     'Tốc độ đọc ghi nhanh, nhỏ gọn mang theo laptop rất tiện.', 5),
    ('customer05@gmail.com', 'dell-xps-15', 4,
     'Màn đẹp, làm việc đồ họa ổn. Hơi nặng khi mang đi.', 14)
    -- ... (~70 rows — xem V41 đầy đủ)
) AS v(email, slug, rating, comment, days_ago)
JOIN users u ON u.email = v.email
JOIN products p ON p.slug = v.slug AND p.deleted_at IS NULL
WHERE NOT EXISTS (
    SELECT 1 FROM product_reviews pr
    WHERE pr.user_id = u.id AND pr.product_id = p.id AND pr.deleted_at IS NULL
);
```

---

## DSS Sales History

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- DSS 30-DAY & 45-DAY SALES HISTORY
-- Files: V36__seed_dss_30day_sales_history.sql
--        V39__seed_dss_multiproduct_sales.sql
-- Markers: TXN_DSS30_SEED | TXN_DSS39_MULTI
-- ============================================

-- V36: Loop 30 ngày — DELIVERED orders cho 12 slug capstone
DO $$
DECLARE
    day_offset INT;
    created_ts TIMESTAMP;
BEGIN
    IF EXISTS (SELECT 1 FROM payments WHERE transaction_id = 'TXN_DSS30_SEED') THEN
        RETURN;
    END IF;

    FOR day_offset IN 0..29 LOOP
        created_ts := CURRENT_TIMESTAMP - make_interval(days => day_offset);
        -- INSERT orders + order_items + payments (DELIVERED)
        -- SP: iphone-15-pro-128gb, dell-xps-15, samsung-t7-ssd-1tb, ...
        -- Buyers: customer01@gmail.com, customer02@gmail.com, customer03@gmail.com
    END LOOP;
END $$;

-- V39: 45 ngày — giỏ 2–4 SP/đơn, marker TXN_DSS39_MULTI
-- (PL/pgSQL — gom V24 + V27 products)
```

---

## DSS Platform Demo Data

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- DSS IDENTITIES, PRODUCTS, 121-DAY SALES
-- File: V43__seed_dss_platform_demo_data.sql
--        V46__seed_dss_owner_sales_history.sql
-- Login: seller.dss.demo@example.com / password
-- ============================================

-- 1. INSERT DSS SELLERS
INSERT INTO users (username, email, password, full_name, status, role_id, store_name, business_email)
SELECT 'seller.dss.demo', 'seller.dss.demo@example.com',
       '$2a$10$MDes8qRTuKmeopk7NxNZv.gZV5kBFMP7cQ2SlVMMfXT6aXqqHnukK',
       'DSS Demo Seller', 'ACTIVE'::user_status, r.id,
       'DSS Demo Store', 'seller.dss.demo@example.com'
FROM roles r WHERE r.name = 'SELLER'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = 'seller.dss.demo@example.com');

-- seller.dss.demo.2 … .4 + customer.dss.demo.1 … .12 (password: password)

-- 2. INSERT DSS CATEGORY + PRODUCTS
INSERT INTO categories (name, slug)
SELECT 'DSS Demo Electronics', 'dss-demo-electronics'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'dss-demo-electronics' AND deleted_at IS NULL);

INSERT INTO products (seller_id, category_id, name, slug, description, price, cost_price, status)
SELECT s.id, c.id, v.name, v.slug, v.description, v.price, v.cost_price, 'ACTIVE'::product_status
FROM (VALUES
    ('Wireless Mouse Pro', 'dss-demo-wireless-mouse-pro', 350000.00::NUMERIC, 210000.00::NUMERIC),
    ('Mechanical Keyboard K87', 'dss-demo-mechanical-keyboard-k87', 1290000.00::NUMERIC, 780000.00::NUMERIC),
    ('Noise Cancelling Headphones', 'dss-demo-noise-cancelling-headphones', 1890000.00::NUMERIC, 1150000.00::NUMERIC),
    ('USB-C Hub 8-in-1', 'dss-demo-usb-c-hub-8-in-1', 990000.00::NUMERIC, 590000.00::NUMERIC),
    ('Urban Travel Backpack', 'dss-demo-urban-travel-backpack', 750000.00::NUMERIC, 450000.00::NUMERIC),
    ('Running Shoes X1', 'dss-demo-running-shoes-x1', 1650000.00::NUMERIC, 990000.00::NUMERIC),
    ('Fitness Smart Watch', 'dss-demo-fitness-smart-watch', 2490000.00::NUMERIC, 1540000.00::NUMERIC),
    ('Digital Coffee Maker', 'dss-demo-digital-coffee-maker', 1750000.00::NUMERIC, 1050000.00::NUMERIC),
    ('Smart Air Fryer', 'dss-demo-smart-air-fryer', 2200000.00::NUMERIC, 1350000.00::NUMERIC)
) AS v(name, slug, price, cost_price)
JOIN users s ON s.email = 'seller.dss.demo@example.com'
JOIN categories c ON c.slug = 'dss-demo-electronics'
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug AND p.deleted_at IS NULL);

-- 3. GENERATE 121 days sales + price_history (3 regimes) + demand_predictions
-- Marker payments: DSS-DEMO-* | [DSS-OWNER-DEMO] (V46)
```

---

## Demo Vouchers

```sql
-- ============================================
-- SCRIPT INSERT SAMPLE DATA
-- DEMO VOUCHERS
-- File: V52__seed_demo_vouchers.sql
-- ============================================

INSERT INTO vouchers (
    code, name, description, discount_type, discount_value, scope, seller_id,
    applies_to, minimum_order_amount, maximum_discount_amount, usage_limit,
    used_count, starts_at, ends_at, is_active, created_by
)
SELECT
    'SEDSP10', 'Giảm 10% toàn sàn',
    'Voucher demo nền tảng — giảm 10%, tối đa 100.000đ',
    'PERCENTAGE', 10, 'PLATFORM', NULL, 'ALL_PRODUCTS',
    200000, 100000, 500, 0,
    NOW() - INTERVAL '1 day', NOW() + INTERVAL '365 days', TRUE, u.id
FROM users u
WHERE u.email = 'manager@sedsp.vn'
  AND NOT EXISTS (
      SELECT 1 FROM vouchers v
      WHERE v.scope = 'PLATFORM' AND UPPER(v.code) = 'SEDSP10'
  );

INSERT INTO vouchers (
    code, name, description, discount_type, discount_value, scope, seller_id,
    applies_to, minimum_order_amount, maximum_discount_amount, usage_limit,
    used_count, starts_at, ends_at, is_active, created_by
)
SELECT
    'SHOP50K', 'Shop giảm 50K', 'Voucher demo shop SEDSP Official',
    'FIXED', 50000, 'SHOP', s.id, 'ALL_PRODUCTS',
    300000, NULL, 200, 0,
    NOW() - INTERVAL '1 day', NOW() + INTERVAL '180 days', TRUE, m.id
FROM users s CROSS JOIN users m
WHERE s.email = 'seller@sedsp.vn' AND m.email = 'manager@sedsp.vn'
  AND NOT EXISTS (
      SELECT 1 FROM vouchers v
      WHERE v.scope = 'SHOP' AND v.seller_id = s.id AND UPPER(v.code) = 'SHOP50K'
  );
```

---

## Localization & Maintenance

```sql
-- ============================================
-- SCRIPT UPDATE SAMPLE DATA
-- VIỆT HÓA + BACKFILL
-- Files: V47, V48, V56, V31
-- ============================================

-- V47: Backfill inventory = 80 cho SP thiếu tồn
INSERT INTO inventory (product_id, available_quantity, reserved_quantity)
SELECT p.id, 80, 0
FROM products p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id);

-- V56: Việt hóa tên/mô tả SP (giữ slug)
UPDATE products SET name = 'Điện thoại Samsung Galaxy S24', description = '...'
WHERE slug = 'samsung-galaxy-s24' AND deleted_at IS NULL;

-- V31: Soft-delete duplicate English categories, đặt tên VI
-- V48: Việt hóa attribute names; set Nhà cung cấp = store_name seller
```
