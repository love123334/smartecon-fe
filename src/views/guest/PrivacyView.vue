<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
</script>

<template>
  <div class="legal-page">
    <PageHeader
      eyebrow="Pháp lý"
      title="Chính sách bảo mật"
      lead="Cách SEDSP thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn."
    />
    <article class="card legal-body">
      <h2>1. Thông tin chúng tôi thu thập</h2>
      <p>
        Tài khoản (email, họ tên, số điện thoại), thông tin đơn hàng, lịch sử mua sắm và dữ liệu
        kỹ thuật cần thiết để vận hành sàn (phiên đăng nhập, nhật ký lỗi).
      </p>

      <h2>2. Mục đích sử dụng</h2>
      <p>
        Xử lý đơn hàng, hỗ trợ khách hàng, gợi ý sản phẩm / DSS cho người bán, bảo mật tài khoản và
        cải thiện trải nghiệm. Chúng tôi không bán dữ liệu cá nhân cho bên thứ ba.
      </p>

      <h2>3. Lưu trữ & bảo mật</h2>
      <p>
        Dữ liệu được lưu trên hạ tầng có kiểm soát truy cập. Bạn có thể yêu cầu cập nhật hoặc xóa
        thông tin hồ sơ trong giới hạn pháp luật và nghĩa vụ vận hành đơn hàng.
      </p>

      <h2>4. Liên hệ</h2>
      <p>
        Thắc mắc về quyền riêng tư: gửi qua trang
        <RouterLink to="/contact">Liên hệ</RouterLink>
        hoặc email <a href="mailto:admin@sedsp.vn">admin@sedsp.vn</a>.
      </p>
    </article>
  </div>
</template>

<style scoped>
.legal-body {
  padding: 1.25rem 1.35rem;
  max-width: 720px;
}
.legal-body h2 {
  margin: 1.25rem 0 0.4rem;
  font-size: 1rem;
}
.legal-body h2:first-child {
  margin-top: 0;
}
.legal-body p {
  margin: 0;
  color: var(--slate-600, #475569);
  line-height: 1.65;
  font-size: 0.9375rem;
}
</style>
