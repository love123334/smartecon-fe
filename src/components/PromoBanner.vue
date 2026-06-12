<template>
  <section class="mkt-promo" aria-label="Khuyến mãi">
    <div class="mkt-promo__main">
      <h2>SIÊU SALE SEDSP</h2>
      <p>Giảm đến 40% — Miễn phí vận chuyển đơn từ 500K. Tích hợp DSS hỗ trợ quyết định mua bán.</p>
      <RouterLink to="/search" class="btn btn-sm" style="background: #fff; color: var(--primary-700); width: fit-content">
        Mua ngay
      </RouterLink>
    </div>
    <div class="mkt-promo__side">
      <RouterLink to="/seller/dss" class="mkt-promo__card mkt-promo__card--dss" style="text-decoration: none; color: inherit">
        <strong>DSS cho Người bán</strong>
        <span>Dự báo nhu cầu · Gợi ý giá · Tồn kho</span>
      </RouterLink>
      <RouterLink to="/recommendations" class="mkt-promo__card mkt-promo__card--ai" style="text-decoration: none; color: inherit">
        <strong>Gợi ý AI thông minh</strong>
        <span>Cá nhân hóa theo lịch sử mua sắm</span>
      </RouterLink>
    </div>
  </section>
</template>
