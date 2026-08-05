<script setup lang="ts">
import { ref } from 'vue'
import { reviewApi } from '@/api/services'
import StarRating from '@/components/StarRating.vue'

const props = defineProps<{
  productId: string
  productName: string
}>()

const emit = defineEmits<{
  submitted: []
}>()

const open = ref(false)
const rating = ref(5)
const comment = ref('')
const saving = ref(false)
const error = ref('')
const done = ref(false)

async function submit() {
  if (!comment.value.trim()) {
    error.value = 'Vui lòng nhập nội dung bình luận'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await reviewApi.create(props.productId, {
      rating: rating.value,
      comment: comment.value.trim(),
    })
    done.value = true
    open.value = false
    emit('submitted')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không gửi được đánh giá'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="order-review">
    <p v-if="done" class="order-review__done">Đã gửi đánh giá cho {{ productName }}.</p>
    <template v-else>
      <button
        v-if="!open"
        type="button"
        class="btn btn-primary btn-sm"
        @click="open = true"
      >
        Đánh giá &amp; bình luận
      </button>
      <form v-else class="order-review__form" @submit.prevent="submit">
        <p class="order-review__title">{{ productName }}</p>
        <div class="order-review__stars">
          <span>Số sao</span>
          <StarRating v-model="rating" />
        </div>
        <label>
          Bình luận
          <textarea v-model="comment" class="input" rows="2" required placeholder="Nhận xét của bạn…" />
        </label>
        <p v-if="error" class="form-error">{{ error }}</p>
        <div class="order-review__actions">
          <button type="submit" class="btn btn-primary btn-sm" :disabled="saving">
            {{ saving ? 'Đang gửi…' : 'Gửi đánh giá' }}
          </button>
          <button type="button" class="btn btn-outline btn-sm" @click="open = false">Hủy</button>
          <RouterLink :to="`/products/${productId}#reviews`" class="btn btn-outline btn-sm">
            Xem trang SP
          </RouterLink>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped>
.order-review {
  margin-top: 0.5rem;
}
.order-review__form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.35rem;
  padding: 0.85rem 0.95rem;
  background: #fff;
  border: 1px solid var(--line, #e4e9f2);
  border-radius: 10px;
  max-width: 420px;
}
.order-review__title {
  margin: 0;
  font-weight: 600;
  font-size: 0.875rem;
}
.order-review__stars {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
}
.order-review__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.order-review__done {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--primary-700, #0f766e);
}
</style>
