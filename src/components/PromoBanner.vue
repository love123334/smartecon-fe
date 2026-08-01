<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useChatWidgetStore } from '@/stores/chatWidget'

const chat = useChatWidgetStore()

function openChat() {
  chat.show()
}
</script>

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
        <span>Dự báo nhu cầu · Gợi ý giá · Doanh số</span>
      </RouterLink>
      <button type="button" class="mkt-promo__card mkt-promo__card--ai" @click="openChat">
        <strong>Trợ lý SEDSP</strong>
        <span>Hỏi giá, ngân sách, so sánh SP trong hộp chat</span>
      </button>
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
}

.mkt-promo__card--ai {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  cursor: pointer;
  border: none;
}
</style>
