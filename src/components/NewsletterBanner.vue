<script setup lang="ts">
import { ref } from 'vue'
import { trySiteFx } from '@/utils/siteFx'

const email = ref('')
const note = ref('')

function onSubmit() {
  if (trySiteFx(email.value)) {
    email.value = ''
    return
  }
  note.value = 'Đã ghi nhận — cảm ơn bạn đã đăng ký.'
  email.value = ''
  window.setTimeout(() => {
    note.value = ''
  }, 2500)
}
</script>

<template>
  <section class="shop-newsletter" aria-label="Đăng ký nhận tin">
    <div class="container shop-newsletter__inner">
      <div class="shop-newsletter__copy">
        <h2>Tham gia bản tin SEDSP</h2>
        <p>Nhận tin khuyến mãi và gợi ý sản phẩm mỗi tuần.</p>
      </div>
      <form class="shop-newsletter__form" @submit.prevent="onSubmit">
        <label for="nl-email" class="sr-only">Email</label>
        <input
          id="nl-email"
          v-model="email"
          type="text"
          inputmode="email"
          placeholder="email@cua-ban.com"
          autocomplete="email"
        />
        <button type="submit" class="shop-newsletter__submit btn-interactive">Đăng ký</button>
      </form>
      <p v-if="note" class="shop-newsletter__note">{{ note }}</p>
    </div>
  </section>
</template>

<style scoped>
.shop-newsletter__note {
  margin: 0.65rem 0 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.75);
  width: 100%;
  text-align: center;
}
</style>
