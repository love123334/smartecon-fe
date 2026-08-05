<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
</script>

<template>
  <div class="legal-page">
    <PageHeader
      eyebrow="Pháp lý"
      title="Điều khoản sử dụng"
      lead="Quy định khi sử dụng nền tảng thương mại điện tử SEDSP."
    />
    <article class="card legal-body">
      <h2>1. Chấp nhận điều khoản</h2>
      <p>
        Khi tạo tài khoản hoặc sử dụng SEDSP, bạn đồng ý với các điều khoản này và chính sách bảo
        mật liên quan.
      </p>

      <h2>2. Tài khoản</h2>
      <p>
        Bạn chịu trách nhiệm bảo mật thông tin đăng nhập. Hành vi gian lận, spam hoặc xâm phạm quyền
        bên thứ ba có thể dẫn tới khóa tài khoản.
      </p>

      <h2>3. Mua bán & thanh toán</h2>
      <p>
        Đơn hàng, giao nhận và thanh toán tuân theo trạng thái đơn trên hệ thống. Người bán chịu
        trách nhiệm mô tả sản phẩm trung thực; người mua kiểm tra kỹ trước khi thanh toán.
      </p>

      <h2>4. Trợ lý AI & DSS</h2>
      <p>
        Gợi ý chatbot và DSS mang tính hỗ trợ quyết định, không thay thế tư vấn chuyên môn. Kết quả
        dự báo / gợi ý giá có thể sai lệch so với thực tế thị trường.
      </p>

      <h2>5. Liên hệ</h2>
      <p>
        Khiếu nại hoặc góp ý: trang
        <RouterLink to="/contact">Liên hệ</RouterLink>
        hoặc <a href="mailto:admin@sedsp.vn">admin@sedsp.vn</a>.
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
