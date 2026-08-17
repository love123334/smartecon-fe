<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatVnd, orderApi } from '@/api/services'
import type { Order } from '@/types'
import type { BackendOrderStatus } from '@/utils/backendOrderStatus'
import {
  BACKEND_STATUS_LABEL,
  backendStatusLabel,
  selectableBackendStatuses,
} from '@/utils/backendOrderStatus'
import OrderTrackStepper from '@/components/OrderTrackStepper.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'

const orders = ref<Order[]>([])
const loading = ref(true)
const updatingId = ref<string | null>(null)
const selectedStatus = ref<Record<string, BackendOrderStatus | ''>>({})
const statusNotes = ref<Record<string, string>>({})
const error = ref('')
const successId = ref<string | null>(null)

const counts = computed(() => {
  const c = { pending: 0, confirmed: 0, shipping: 0, delivered: 0, other: 0 }
  for (const o of orders.value) {
    if (o.status === 'pending') c.pending++
    else if (o.status === 'confirmed') c.confirmed++
    else if (o.status === 'shipping') c.shipping++
    else if (o.status === 'delivered') c.delivered++
    else c.other++
  }
  return c
})

async function loadOrders() {
  loading.value = true
  error.value = ''
  try {
    const result = await orderApi.listForSellerWithMeta()
    orders.value = result.orders
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được đơn hàng'
  } finally {
    loading.value = false
  }
}

onMounted(loadOrders)

function statusOptions(order: Order): BackendOrderStatus[] {
  return selectableBackendStatuses(order.rawStatus, 'seller')
}

function canUpdateStatus(order: Order): boolean {
  return statusOptions(order).length > 0
}

function accentClass(order: Order): string {
  if (order.status === 'pending') return 'seller-order--pending'
  if (order.status === 'confirmed') return 'seller-order--confirmed'
  if (order.status === 'shipping') return 'seller-order--shipping'
  if (order.status === 'delivered') return 'seller-order--delivered'
  if (order.status === 'cancelled') return 'seller-order--cancelled'
  return ''
}

async function applyStatus(order: Order) {
  const status = selectedStatus.value[order.id]
  if (!status || status === order.rawStatus) return
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

  try {
    const { order: updated } = await orderApi.updateBackendStatus(
      order.id,
      status,
      statusNotes.value[order.id]?.trim() || undefined,
    )
    if (idx >= 0) orders.value[idx] = updated
    delete selectedStatus.value[order.id]
    successId.value = order.id
  } catch (e) {
    if (idx >= 0) orders.value[idx] = prev
    error.value = e instanceof Error ? e.message : 'Cập nhật thất bại'
  } finally {
    updatingId.value = null
  }
}
</script>

<template>
  <div class="seller-orders-page">
    <PageHeader
      eyebrow="Người bán"
      title="Quản lý đơn hàng"
      lead="Theo dõi tiến trình và cập nhật trạng thái từng đơn cho khách."
    />

    <p v-if="error" class="form-error">{{ error }}</p>
    <LoadingSpinner v-if="loading" label="Đang tải đơn hàng" />
    <p v-else-if="!orders.length" class="seller-orders-empty">Chưa có đơn hàng nào.</p>

    <template v-else>
      <div class="seller-orders-summary" aria-label="Tóm tắt đơn">
        <div class="seller-orders-summary__item">
          <span>Tổng</span>
          <strong>{{ orders.length }}</strong>
        </div>
        <div class="seller-orders-summary__item seller-orders-summary__item--warn">
          <span>Chờ xử lý</span>
          <strong>{{ counts.pending }}</strong>
        </div>
        <div class="seller-orders-summary__item">
          <span>Đã xác nhận</span>
          <strong>{{ counts.confirmed }}</strong>
        </div>
        <div class="seller-orders-summary__item">
          <span>Đang giao</span>
          <strong>{{ counts.shipping }}</strong>
        </div>
        <div class="seller-orders-summary__item seller-orders-summary__item--ok">
          <span>Đã giao</span>
          <strong>{{ counts.delivered }}</strong>
        </div>
      </div>

      <div class="seller-orders">
        <article
          v-for="(o, idx) in orders"
          :key="o.id"
          class="seller-order"
          :class="accentClass(o)"
          :style="{ '--enter-delay': `${Math.min(idx, 8) * 40}ms` }"
        >
          <header class="seller-order__head">
            <div class="seller-order__id-block">
              <p class="seller-order__eyebrow">Đơn hàng</p>
              <h2 class="seller-order__id">#{{ o.id }}</h2>
              <p class="seller-order__meta">
                <span>{{ o.customerName || 'Khách' }}</span>
                <span aria-hidden="true">·</span>
                <time :datetime="o.createdAt">{{ new Date(o.createdAt).toLocaleString('vi-VN') }}</time>
              </p>
            </div>
            <div class="seller-order__aside">
              <span class="seller-order__badge" :class="`badge-${o.status}`">
                {{ backendStatusLabel(o.rawStatus ?? o.status) }}
              </span>
              <strong class="seller-order__total">{{ formatVnd(o.total) }}</strong>
            </div>
          </header>

          <div class="seller-order__track">
            <OrderTrackStepper :status="o.status" compact show-hint perspective="seller" />
          </div>

          <section class="seller-order__items" aria-label="Sản phẩm trong đơn">
            <h3 class="seller-order__section-label">Sản phẩm</h3>
            <ul v-if="o.items.length" class="seller-order__item-list">
              <li v-for="item in o.items" :key="item.productId">
                <span class="seller-order__item-name">{{ item.productName }}</span>
                <span class="seller-order__item-qty">× {{ item.quantity }}</span>
              </li>
            </ul>
            <p v-else class="seller-order__items-empty">Chi tiết dòng hàng chưa đầy đủ từ API.</p>
          </section>

          <footer v-if="canUpdateStatus(o)" class="seller-order__actions">
            <p class="seller-order__section-label">Cập nhật trạng thái</p>
            <div class="seller-order__form">
              <label class="seller-order__field">
                <span class="seller-order__field-label">Trạng thái mới</span>
                <select v-model="selectedStatus[o.id]" class="seller-order__select">
                  <option disabled value="">— Chọn trạng thái —</option>
                  <option v-for="s in statusOptions(o)" :key="s" :value="s">
                    {{ BACKEND_STATUS_LABEL[s] }}
                  </option>
                </select>
              </label>
              <label class="seller-order__field seller-order__field--grow">
                <span class="seller-order__field-label">Ghi chú</span>
                <input
                  v-model="statusNotes[o.id]"
                  type="text"
                  class="seller-order__input"
                  placeholder="Ghi chú giao hàng (tuỳ chọn)"
                />
              </label>
              <button
                type="button"
                class="btn btn-primary seller-order__submit"
                :disabled="updatingId === o.id || !selectedStatus[o.id] || selectedStatus[o.id] === o.rawStatus"
                @click="applyStatus(o)"
              >
                {{ updatingId === o.id ? 'Đang lưu…' : 'Cập nhật' }}
              </button>
            </div>
            <p v-if="successId === o.id" class="seller-order__ok" role="status">
              Đã cập nhật trạng thái.
            </p>
          </footer>
          <p v-else class="seller-order__done">Đơn đã hoàn tất / hủy — không còn bước cập nhật.</p>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.seller-orders-page {
  --so-gap: 1.15rem;
}

.seller-orders-empty {
  margin: 1.5rem 0;
  padding: 2rem 1.25rem;
  text-align: center;
  color: var(--slate-500);
  background: var(--slate-50);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--slate-200);
}

.seller-orders-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 0 0 1.35rem;
}

.seller-orders-summary__item {
  padding: 0.85rem 1rem;
  background: #fff;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.seller-orders-summary__item span {
  font-size: 0.75rem;
  color: var(--slate-500);
  font-weight: 500;
}

.seller-orders-summary__item strong {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--slate-900);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.seller-orders-summary__item--warn strong {
  color: #b45309;
}

.seller-orders-summary__item--ok strong {
  color: var(--primary-700);
}

.seller-orders {
  display: flex;
  flex-direction: column;
  gap: var(--so-gap);
}

.seller-order {
  position: relative;
  background: #fff;
  border: 1px solid var(--slate-200);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 0 rgba(20, 39, 92, 0.04);
  animation: so-enter 0.45s ease both;
  animation-delay: var(--enter-delay, 0ms);
}

.seller-order::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--so-accent, var(--slate-300));
}

.seller-order--pending {
  --so-accent: #f59e0b;
}

.seller-order--confirmed {
  --so-accent: var(--primary-500);
}

.seller-order--shipping {
  --so-accent: #3b82f6;
}

.seller-order--delivered {
  --so-accent: #10b981;
}

.seller-order--cancelled {
  --so-accent: #94a3b8;
}

.seller-order__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.35rem 1rem 1.45rem;
}

.seller-order__eyebrow {
  margin: 0 0 0.15rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--slate-400);
}

.seller-order__id {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 750;
  letter-spacing: -0.03em;
  color: var(--slate-900);
  font-family: var(--font-display, inherit);
}

.seller-order__meta {
  margin: 0.35rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: var(--slate-500);
}

.seller-order__aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.45rem;
}

.seller-order__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.7rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.seller-order__total {
  font-size: 1.2rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: var(--slate-900);
  font-variant-numeric: tabular-nums;
}

.seller-order__track {
  margin: 0 1.35rem 0 1.45rem;
  padding: 0.85rem 1rem;
  background: linear-gradient(180deg, var(--slate-50) 0%, #fff 100%);
  border: 1px solid var(--slate-100);
  border-radius: 10px;
}

.seller-order__items {
  padding: 1.1rem 1.35rem 1rem 1.45rem;
}

.seller-order__section-label {
  margin: 0 0 0.55rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--slate-400);
}

.seller-order__item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.seller-order__item-list li {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  background: var(--slate-50);
  border-radius: 8px;
  font-size: 0.9rem;
}

.seller-order__item-name {
  color: var(--slate-800);
  font-weight: 500;
}

.seller-order__item-qty {
  flex-shrink: 0;
  font-weight: 700;
  color: var(--slate-600);
  font-variant-numeric: tabular-nums;
}

.seller-order__items-empty {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--slate-500);
}

.seller-order__actions {
  padding: 1rem 1.35rem 1.25rem 1.45rem;
  border-top: 1px solid var(--slate-100);
  background: linear-gradient(180deg, #fafbfd 0%, #fff 100%);
}

.seller-order__form {
  display: grid;
  grid-template-columns: minmax(140px, 180px) minmax(0, 1fr) auto;
  gap: 0.65rem;
  align-items: end;
}

.seller-order__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
}

.seller-order__field--grow {
  min-width: 0;
}

.seller-order__field-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--slate-500);
}

.seller-order__select,
.seller-order__input {
  width: 100%;
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--slate-200);
  border-radius: 9px;
  background: #fff;
  font-size: 0.875rem;
  color: var(--slate-800);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.seller-order__select:focus,
.seller-order__input:focus {
  outline: none;
  border-color: var(--primary-400);
  box-shadow: 0 0 0 3px var(--primary-50);
}

.seller-order__submit {
  min-height: 2.5rem;
  padding-inline: 1.15rem;
  white-space: nowrap;
  border-radius: 9px;
}

.seller-order__ok {
  margin: 0.65rem 0 0;
  font-size: 0.8125rem;
  color: #0f766e;
  font-weight: 600;
}

.seller-order__done {
  margin: 0;
  padding: 0.85rem 1.35rem 1.15rem 1.45rem;
  font-size: 0.8125rem;
  color: var(--slate-500);
  border-top: 1px solid var(--slate-100);
}

.muted {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--slate-500);
}

@keyframes so-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .seller-orders-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .seller-orders-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .seller-order__aside {
    align-items: flex-start;
  }

  .seller-order__form {
    grid-template-columns: 1fr;
  }

  .seller-order__submit {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .seller-order {
    animation: none;
  }
}
</style>
