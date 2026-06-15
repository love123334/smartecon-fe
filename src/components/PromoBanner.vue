<template>
  <section class="mkt-promo mkt-promo--animate" aria-label="Khuyến mãi">
    <div class="mkt-promo__main mkt-promo__main--shine">
      <h2>Giảm tới <em>65%</em> mấy món hot</h2>
      <p>Tai nghe, bàn phím, màn hình… đồ chính hãng giá tốt trong vài giờ tới. Có gì ưng thì chốt sớm nhé.</p>
      <RouterLink to="/search" class="btn btn-sm btn-interactive btn-glow mkt-promo__cta">
        Mua ngay →
      </RouterLink>
    </div>
    <div class="mkt-promo__side">
      <RouterLink to="/seller/dss" class="mkt-promo__card mkt-promo__card--dss" style="text-decoration: none; color: inherit">
        <strong>DSS cho người bán</strong>
        <span>Dự báo nhu cầu · Gợi ý giá · Tồn kho</span>
      </RouterLink>
      <RouterLink to="/recommendations" class="mkt-promo__card mkt-promo__card--ai" style="text-decoration: none; color: inherit">
        <strong>Gợi ý phù hợp bạn</strong>
        <span>Dựa trên lịch sử mua sắm của bạn</span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.mkt-promo__main h2 em {
  font-style: normal;
  color: var(--primary-500);
}

.mkt-promo__cta {
  background: var(--primary-600);
  color: #fff;
  width: fit-content;
  z-index: 1;
  position: relative;
}
</style>
