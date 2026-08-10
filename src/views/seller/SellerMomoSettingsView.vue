<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import MomoWalletSettings from '@/components/MomoWalletSettings.vue'
</script>

<template>
  <div class="seller-momo-page">
    <PageHeader
      eyebrow="Người bán"
      title="MoMo nhận tiền (QR / SĐT)"
      lead="Cấu hình ví MoMo nhận tiền từ khách. Thanh toán thành công sẽ tự xác nhận đơn — không cần bấm xác nhận thủ công."
    />

    <div class="card seller-momo-page__card">
      <MomoWalletSettings compact seller-mode />
      <p class="elegant-muted seller-momo-page__profile-link">
        Hoặc quản lý tại
        <RouterLink to="/profile#momo-wallet">Hồ sơ → Ví MoMo</RouterLink>.
      </p>
    </div>
  </div>
</template>

<style scoped>
.seller-momo-page__card {
  max-width: 520px;
}

.seller-momo-page__profile-link {
  margin-top: 1rem;
  font-size: 0.875rem;
}
</style>
