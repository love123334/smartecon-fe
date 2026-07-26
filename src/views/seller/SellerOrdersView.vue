<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatVnd, orderApi } from '@/api/services'
import type { Order, SellerOrdersSource } from '@/types'
import type { BackendOrderStatus } from '@/utils/backendOrderStatus'
import {
  BACKEND_STATUS_LABEL,
  backendStatusLabel,
  nextBackendStatuses,
} from '@/utils/backendOrderStatus'
import HybridDataNotice from '@/components/HybridDataNotice.vue'
import OrderTrackStepper from '@/components/OrderTrackStepper.vue'
import PageHeader from '@/components/PageHeader.vue'

const orders = ref<Order[]>([])
const loading = ref(true)
const updatingId = ref<string | null>(null)
const selectedStatus = ref<Record<string, BackendOrderStatus>>({})
const statusNotes = ref<Record<string, string>>({})
const error = ref('')
const source = ref<SellerOrdersSource>('mock')
const statusDemoOnly = ref(false)

async function loadOrders() {
  loading.value = true
  error.value = ''
  try {
    const result = await orderApi.listForSellerWithMeta()
    orders.value = result.orders
    source.value = result.source
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
  try {
    const { order: updated, persistedOnBackend } = await orderApi.updateBackendStatus(
      order.id,
      status,
      statusNotes.value[order.id]?.trim() || undefined,
    )
    statusDemoOnly.value = !persistedOnBackend
    const idx = orders.value.findIndex((o) => o.id === order.id)
    if (idx >= 0) orders.value[idx] = updated
    const next = nextBackendStatuses(updated.rawStatus)[0]
    if (next) selectedStatus.value[order.id] = next
    else delete selectedStatus.value[order.id]
  } catch (e) {
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

    <HybridDataNotice
      v-if="source === 'dashboard'"
      message="Đơn hàng từ GET /seller/dashboard (recentOrders). Chi tiết line items có thể chưa đầy đủ."
    />
    <HybridDataNotice
      v-else-if="source === 'mock'"
      message="Backend không phản hồi — hiển thị đơn demo trong trình duyệt."
    />
    <HybridDataNotice
      v-if="statusDemoOnly"
      message="Trạng thái vừa lưu ở chế độ demo (local). Backend hiện chỉ hỗ trợ hủy đơn qua PUT /orders/{id}/cancel."
    />

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="loading" class="muted">Đang tải đơn hàng…</p>
    <p v-else-if="!orders.length" class="empty">Chưa có đơn hàng nào.</p>

    <div v-else class="seller-orders">
      <article v-for="o in orders" :key="o.id" class="card seller-order-card">
        <div class="seller-order-card__head">
          <div>
            <strong>#{{ o.id }}</strong>
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

        <div class="status-cell">
          <template v-if="statusOptions(o).length">
            <select v-model="selectedStatus[o.id]" class="input input--sm">
              <option
                v-for="s in statusOptions(o)"
                :key="s"
                :value="s"
              >
                {{ BACKEND_STATUS_LABEL[s] }}
              </option>
            </select>
            <input
              v-model="statusNotes[o.id]"
              type="text"
              class="input input--sm"
              placeholder="Ghi chú giao hàng (tuỳ chọn)"
            />
            <button
              type="button"
              class="btn btn--sm btn--primary"
              :disabled="updatingId === o.id"
              @click="applyStatus(o)"
            >
              {{ updatingId === o.id ? 'Đang lưu…' : 'Cập nhật trạng thái' }}
            </button>
          </template>
          <span v-else class="muted">Đơn đã hoàn tất / hủy — không còn bước cập nhật.</span>
        </div>
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
  padding: 1rem 1.15rem;
}

.seller-order-card__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.seller-order-card__total {
  display: flex;
  flex-wrap: wrap;
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
