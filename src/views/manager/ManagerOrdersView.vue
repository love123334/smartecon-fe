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
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'

const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref('')
const updatingId = ref<string | null>(null)
const selectedStatus = ref<Record<string, BackendOrderStatus>>({})
const statusNotes = ref<Record<string, string>>({})

async function load() {
  loading.value = true
  error.value = ''
  try {
    orders.value = await orderApi.listAll()
    for (const o of orders.value) {
      const next = nextBackendStatuses(o.rawStatus)[0]
      if (next) selectedStatus.value[o.id] = next
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được đơn'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function statusOptions(order: Order): BackendOrderStatus[] {
  return nextBackendStatuses(order.rawStatus)
}

async function applyStatus(order: Order) {
  const status = selectedStatus.value[order.id]
  if (!status) return
  updatingId.value = order.id
  error.value = ''
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
      eyebrow="Quản lý"
      title="Giám sát & cập nhật đơn hàng"
      lead="Theo dõi toàn bộ đơn, xác nhận / đẩy giao / hoàn tất cho khách."
    />

    <p v-if="error" class="form-error">{{ error }}</p>
    <LoadingSpinner v-if="loading" label="Đang tải" />
    <p v-else-if="!orders.length" class="empty">Chưa có đơn hàng để giám sát.</p>

    <div v-else class="mgr-orders">
      <article v-for="o in orders" :key="o.id" class="card mgr-order">
        <div class="mgr-order__head">
          <div>
            <strong>#{{ o.id }}</strong>
            <p class="muted">
              {{ o.customerName || 'Khách' }}
              · {{ new Date(o.createdAt).toLocaleString('vi-VN') }}
            </p>
          </div>
          <div class="mgr-order__meta">
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

        <div class="status-cell">
          <template v-if="statusOptions(o).length">
            <select v-model="selectedStatus[o.id]" class="input input--sm">
              <option v-for="s in statusOptions(o)" :key="s" :value="s">
                {{ BACKEND_STATUS_LABEL[s] }}
              </option>
            </select>
            <input
              v-model="statusNotes[o.id]"
              type="text"
              class="input input--sm"
              placeholder="Ghi chú vận hành"
            />
            <button
              type="button"
              class="btn btn--sm btn--primary"
              :disabled="updatingId === o.id"
              @click="applyStatus(o)"
            >
              {{ updatingId === o.id ? 'Đang lưu…' : 'Cập nhật' }}
            </button>
          </template>
          <span v-else class="muted">Không còn bước cập nhật</span>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.mgr-orders {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.mgr-order {
  padding: 1rem 1.15rem;
}
.mgr-order__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
}
.mgr-order__meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.item-list {
  margin: 0.5rem 0 0.75rem;
  padding-left: 1rem;
  font-size: 0.875rem;
}
.status-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
.input--sm {
  font-size: 0.8125rem;
  padding: 0.25rem 0.5rem;
  min-width: 140px;
}
.btn--sm {
  font-size: 0.8125rem;
  padding: 0.3rem 0.65rem;
}
.muted {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--slate-500, #64748b);
  font-weight: 400;
}
</style>
