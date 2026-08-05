<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatVnd, orderApi } from '@/api/services'
import type { Order } from '@/types'
import type { BackendOrderStatus } from '@/utils/backendOrderStatus'
import {
  BACKEND_STATUS_LABEL,
  backendStatusLabel,
  nextBackendStatuses,
} from '@/utils/backendOrderStatus'
import OrderTrackStepper from '@/components/OrderTrackStepper.vue'
import PageHeader from '@/components/PageHeader.vue'

const orders = ref<Order[]>([])
const loading = ref(true)
const updatingId = ref<string | null>(null)
const selectedStatus = ref<Record<string, BackendOrderStatus>>({})
const statusNotes = ref<Record<string, string>>({})
const error = ref('')
const successId = ref<string | null>(null)

async function loadOrders() {
  loading.value = true
  error.value = ''
  try {
    const result = await orderApi.listForSellerWithMeta()
    orders.value = result.orders
    for (const o of orders.value) {
      const next = nextBackendStatuses(o.rawStatus)[0]
      if (next) selectedStatus.value[o.id] = next
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được đơn hàng'
  } finally {
    loading.value = false
  }
}

onMounted(loadOrders)

function statusOptions(order: Order): BackendOrderStatus[] {
  return nextBackendStatuses(order.rawStatus)
}

async function applyStatus(order: Order) {
  const status = selectedStatus.value[order.id]
  if (!status) return
  updatingId.value = order.id
  error.value = ''
  successId.value = null
  const prev = { ...order }
  const optimistic: Order = {
    ...order,
    rawStatus: status,
    status:
      status === 'PROCESSING' || status === 'PAID'
        ? 'confirmed'
        : status === 'SHIPPING'
          ? 'shipping'
          : status === 'DELIVERED'
            ? 'delivered'
            : status === 'CANCELLED'
              ? 'cancelled'
              : order.status,
    updatedAt: new Date().toISOString(),
  }
  const idx = orders.value.findIndex((o) => o.id === order.id)
  if (idx >= 0) orders.value[idx] = optimistic
  const nextOpt = nextBackendStatuses(status)[0]
  if (nextOpt) selectedStatus.value[order.id] = nextOpt
  else delete selectedStatus.value[order.id]

  try {
    const { order: updated } = await orderApi.updateBackendStatus(
      order.id,
      status,
      statusNotes.value[order.id]?.trim() || undefined,
    )
    if (idx >= 0) orders.value[idx] = updated
    const next = nextBackendStatuses(updated.rawStatus)[0]
    if (next) selectedStatus.value[order.id] = next
    else delete selectedStatus.value[order.id]
    successId.value = order.id
  } catch (e) {
    if (idx >= 0) orders.value[idx] = prev
    selectedStatus.value[order.id] = status
    error.value = e instanceof Error ? e.message : 'Cập nhật thất bại'
  } finally {
    updatingId.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Người bán"
      title="Quản lý đơn hàng"
      lead="Theo dõi tiến trình từng đơn (chờ → xác nhận → giao → hoàn tất) và cập nhật trạng thái cho khách."
    />

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="loading" class="muted">Đang tải đơn hàng…</p>
    <p v-else-if="!orders.length" class="empty">Chưa có đơn hàng nào.</p>

    <div v-else class="seller-orders">
      <article v-for="o in orders" :key="o.id" class="card seller-order-card">
        <div class="seller-order-card__head">
          <div>
            <h2 class="seller-order-card__id">#{{ o.id }}</h2>
            <p class="muted">
              {{ o.customerName || 'Khách' }}
              · {{ new Date(o.createdAt).toLocaleString('vi-VN') }}
            </p>
          </div>
          <div class="seller-order-card__total">
            <span class="badge" :class="`badge-${o.status}`">
              {{ backendStatusLabel(o.rawStatus ?? o.status) }}
            </span>
            <strong>{{ formatVnd(o.total) }}</strong>
          </div>
        </div>

        <OrderTrackStepper :status="o.status" compact show-hint />

        <ul v-if="o.items.length" class="item-list">
          <li v-for="item in o.items" :key="item.productId">
            {{ item.productName }} × {{ item.quantity }}
          </li>
        </ul>
        <p v-else class="muted">Chi tiết dòng hàng có thể chưa đầy đủ từ API.</p>

        <div v-if="statusOptions(o).length" class="status-cell">
          <select v-model="selectedStatus[o.id]" class="input status-cell__select">
            <option v-for="s in statusOptions(o)" :key="s" :value="s">
              {{ BACKEND_STATUS_LABEL[s] }}
            </option>
          </select>
          <input
            v-model="statusNotes[o.id]"
            type="text"
            class="input status-cell__note"
            placeholder="Ghi chú giao hàng (tuỳ chọn)"
          />
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="updatingId === o.id"
            @click="applyStatus(o)"
          >
            {{ updatingId === o.id ? 'Đang lưu…' : 'Cập nhật trạng thái' }}
          </button>
        </div>
        <p v-else class="muted">Đơn đã hoàn tất / hủy — không còn bước cập nhật.</p>
        <p v-if="successId === o.id" class="seller-order-card__ok" role="status">
          Đã cập nhật trạng thái.
        </p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.seller-orders {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.seller-order-card {
  padding: 1.1rem 1.2rem;
  border-radius: 12px;
}

.seller-order-card__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.seller-order-card__id {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.seller-order-card__total {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.item-list {
  margin: 0.65rem 0 0.85rem;
  padding-left: 1.1rem;
  font-size: 0.9rem;
}

.status-cell {
  display: grid;
  grid-template-columns: minmax(140px, 180px) minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
}

.status-cell__select,
.status-cell__note {
  font-size: 0.875rem;
  min-height: 2.25rem;
}

.seller-order-card__ok {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: #0f766e;
  font-weight: 600;
}

.muted {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--slate-500, #64748b);
  font-weight: 400;
}

@media (max-width: 720px) {
  .status-cell {
    grid-template-columns: 1fr;
  }
}
</style>
