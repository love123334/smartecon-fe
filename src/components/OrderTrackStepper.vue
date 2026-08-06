<script setup lang="ts">
import { computed } from 'vue'
import type { OrderStatus } from '@/types'

const props = withDefaults(
  defineProps<{
    status: OrderStatus
    compact?: boolean
    /** Hiện ghi chú theo dõi ngắn */
    showHint?: boolean
    /** Gợi ý theo góc nhìn khách / seller */
    perspective?: 'customer' | 'seller'
  }>(),
  { perspective: 'customer' },
)

const customerHints: Record<Exclude<OrderStatus, 'cancelled'>, string> = {
  pending: 'Shop đang xem đơn của bạn',
  confirmed: 'Shop đã nhận đơn, chuẩn bị hàng',
  shipping: 'Đơn đang trên đường giao',
  delivered: 'Giao thành công — có thể đánh giá trong 30 ngày',
}

const sellerHints: Record<Exclude<OrderStatus, 'cancelled'>, string> = {
  pending: 'Khách đang chờ bạn xác nhận đơn',
  confirmed: 'Chuẩn bị hàng rồi chuyển sang đang giao',
  shipping: 'Đơn đang giao — cập nhật khi khách nhận',
  delivered: 'Đã hoàn tất — không còn bước cập nhật',
}

const steps: { key: Exclude<OrderStatus, 'cancelled'>; label: string }[] = [
  { key: 'pending', label: 'Chờ xác nhận' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'shipping', label: 'Đang giao' },
  { key: 'delivered', label: 'Đã giao' },
]

const index = computed(() => {
  if (props.status === 'cancelled') return -1
  return steps.findIndex((s) => s.key === props.status)
})

const activeHint = computed(() => {
  if (props.status === 'cancelled') {
    return props.perspective === 'seller' ? 'Đơn đã hủy' : 'Đơn đã bị hủy'
  }
  const i = index.value
  if (i < 0) return ''
  const key = steps[i]?.key
  if (!key) return ''
  return (props.perspective === 'seller' ? sellerHints : customerHints)[key]
})

function stepClass(i: number) {
  if (index.value < 0) return ''
  if (i < index.value) return 'order-track__step--done'
  if (i === index.value) return 'order-track__step--active'
  return ''
}
</script>

<template>
  <div class="order-track" :class="{ 'order-track--compact': compact }">
    <p v-if="status === 'cancelled'" class="order-track__cancelled">
      {{ perspective === 'seller' ? 'Đơn đã hủy — không cập nhật thêm.' : 'Đơn đã hủy — không còn theo dõi giao hàng.' }}
    </p>
    <ol v-else class="order-track__list" aria-label="Tiến trình đơn hàng">
      <li
        v-for="(step, i) in steps"
        :key="step.key"
        class="order-track__step"
        :class="stepClass(i)"
      >
        <span class="order-track__dot" aria-hidden="true">{{ i + 1 }}</span>
        <span class="order-track__label">{{ step.label }}</span>
      </li>
    </ol>
    <p v-if="showHint && activeHint" class="order-track__hint">{{ activeHint }}</p>
  </div>
</template>

<style scoped>
.order-track {
  margin: 0;
}

.order-track__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.order-track__step {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  color: var(--slate-400, #94a3b8);
}

.order-track__dot {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  border: 1.5px solid currentColor;
}

.order-track__step--done {
  color: var(--primary-600);
}

.order-track__step--done .order-track__dot {
  background: var(--primary-600);
  color: #fff;
  border-color: transparent;
}

.order-track__step--active {
  color: var(--slate-900);
  font-weight: 600;
}

.order-track__step--active .order-track__dot {
  border-color: var(--primary-700);
  background: var(--primary-600);
  color: #fff;
}

.order-track__hint,
.order-track__cancelled {
  margin: 0.55rem 0 0;
  font-size: 0.8125rem;
  color: var(--slate-500);
}

.order-track--compact .order-track__label {
  font-size: 0.75rem;
}

.order-track--compact .order-track__dot {
  width: 1.1rem;
  height: 1.1rem;
  font-size: 0.62rem;
}
</style>
