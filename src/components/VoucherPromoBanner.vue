<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatVnd, voucherApi } from '@/api/services'
import type { Voucher } from '@/api/real/vouchers'

const props = defineProps<{ sellerId?: number | string | null }>()

const vouchers = ref<Voucher[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const sid = props.sellerId != null ? Number(props.sellerId) : undefined
    vouchers.value = await voucherApi.listPublic(Number.isFinite(sid) ? sid : undefined)
  } catch {
    vouchers.value = []
  } finally {
    loading.value = false
  }
})

function label(v: Voucher) {
  return v.discountType === 'PERCENTAGE' ? `Giảm ${v.discountValue}%` : `Giảm ${formatVnd(v.discountValue)}`
}
</script>

<template>
  <aside v-if="!loading && vouchers.length" class="voucher-banner" aria-label="Mã khuyến mãi">
    <strong>🎟 Mã voucher đang áp dụng</strong>
    <ul>
      <li v-for="v in vouchers.slice(0, 4)" :key="v.id">
        <code>{{ v.code }}</code> — {{ label(v) }}
        <span v-if="v.description"> · {{ v.description }}</span>
        <span v-else-if="v.name"> · {{ v.name }}</span>
      </li>
    </ul>
    <p class="voucher-banner__hint">Nhập mã ở bước thanh toán hoặc hỏi chatbot «mã giảm giá».</p>
  </aside>
</template>

<style scoped>
.voucher-banner {
  margin: 0 0 1rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: linear-gradient(90deg, #ecfdf5, #eff6ff);
  border: 1px solid #a7f3d0;
  font-size: 0.92rem;
}
.voucher-banner ul {
  margin: 0.45rem 0 0;
  padding-left: 1.1rem;
}
.voucher-banner__hint {
  margin: 0.5rem 0 0;
  color: #64748b;
  font-size: 0.82rem;
}
code {
  font-weight: 700;
  color: #0f766e;
}
</style>
