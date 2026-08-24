<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { orderApi } from '@/api/services'
import { clearApiCache } from '@/api/http/client'
import type { Order, OrderStatus } from '@/types'

const props = defineProps<{
  orderId?: number | string
  messageContent?: string
  role?: string
}>()

const emit = defineEmits<{
  'status-updated': [orderId: string, newStatus: OrderStatus]
  navigate: [path: string]
}>()

const loading = ref(false)
const updatingStatus = ref<string | null>(null)
const actionSuccessMsg = ref('')
const actionErrorMsg = ref('')
const orderData = ref<Order | null>(null)

// Parse orderId from props or content regex (#1234 or đơn 1234)
const resolvedOrderId = computed<string | null>(() => {
  if (props.orderId) return String(props.orderId)
  if (!props.messageContent) return null
  const match = props.messageContent.match(/#(\d+)|đơn\s+(\d+)/i)
  return match ? (match[1] || match[2] || null) : null
})

const isSeller = computed(() => props.role === 'seller' || props.role === 'manager' || props.role === 'admin')

const currentStatus = computed<OrderStatus | null>(() => {
  if (orderData.value) return orderData.value.status
  if (!props.messageContent) return null
  const lower = props.messageContent.toLowerCase()
  if (lower.includes('đã giao') || lower.includes('delivered')) return 'delivered'
  if (lower.includes('đang giao') || lower.includes('shipping')) return 'shipping'
  if (lower.includes('đã thanh toán') || lower.includes('xác nhận') || lower.includes('confirmed')) return 'confirmed'
  if (lower.includes('hủy') || lower.includes('cancelled')) return 'cancelled'
  if (lower.includes('đặt đơn') || lower.includes('pending') || lower.includes('chờ')) return 'pending'
  return null
})

async function fetchOrderDetail() {
  if (!resolvedOrderId.value) return
  try {
    const fetched = await orderApi.getById(resolvedOrderId.value)
    if (fetched) orderData.value = fetched
  } catch {
    /* ignore background fetch error */
  }
}

onMounted(() => {
  if (resolvedOrderId.value) {
    void fetchOrderDetail()
  }
})

async function handleUpdateStatus(nextStatus: OrderStatus, label: string) {
  if (!resolvedOrderId.value || loading.value) return
  loading.value = true
  updatingStatus.value = nextStatus
  actionSuccessMsg.value = ''
  actionErrorMsg.value = ''
  try {
    const updated = await orderApi.updateStatus(resolvedOrderId.value, nextStatus)
    orderData.value = updated
    actionSuccessMsg.value = `Đã chuyển sang "${label}"`
    clearApiCache('/orders')
    clearApiCache('/dss')
    emit('status-updated', resolvedOrderId.value, nextStatus)
  } catch (e) {
    actionErrorMsg.value = e instanceof Error ? e.message : 'Cập nhật trạng thái thất bại'
  } finally {
    loading.value = false
    updatingStatus.value = null
  }
}

function viewDetail() {
  if (resolvedOrderId.value) {
    const path = isSeller.value
      ? `/seller/orders`
      : `/orders/${resolvedOrderId.value}`
    emit('navigate', path)
  }
}
</script>

<template>
  <div v-if="resolvedOrderId" class="chat-order-card">
    <div class="chat-order-card__header">
      <span class="chat-order-card__id">Mã đơn #{{ resolvedOrderId }}</span>
      <span v-if="currentStatus" :class="['chat-order-card__badge', `chat-order-card__badge--${currentStatus}`]">
        {{
          currentStatus === 'pending'
            ? 'Chờ xác nhận'
            : currentStatus === 'confirmed'
              ? 'Đã xác nhận'
              : currentStatus === 'shipping'
                ? 'Đang giao'
                : currentStatus === 'delivered'
                  ? 'Đã giao'
                  : 'Đã hủy'
        }}
      </span>
    </div>

    <!-- Seller actions -->
    <div v-if="isSeller" class="chat-order-card__actions">
      <span class="chat-order-card__actions-label">Thao tác nhanh shop:</span>
      <div class="chat-order-card__buttons">
        <button
          v-if="currentStatus === 'pending'"
          type="button"
          class="chat-order-btn chat-order-btn--confirm"
          :disabled="loading"
          @click="handleUpdateStatus('confirmed', 'Đã xác nhận')"
        >
          <span v-if="updatingStatus === 'confirmed'" class="spinner-dot" />
          ⚡ Xác nhận đơn
        </button>

        <button
          v-if="currentStatus === 'pending' || currentStatus === 'confirmed'"
          type="button"
          class="chat-order-btn chat-order-btn--shipping"
          :disabled="loading"
          @click="handleUpdateStatus('shipping', 'Đang giao hàng')"
        >
          <span v-if="updatingStatus === 'shipping'" class="spinner-dot" />
          🚚 Đang giao hàng
        </button>

        <button
          v-if="currentStatus === 'shipping' || currentStatus === 'confirmed'"
          type="button"
          class="chat-order-btn chat-order-btn--delivered"
          :disabled="loading"
          @click="handleUpdateStatus('delivered', 'Đã giao hàng')"
        >
          <span v-if="updatingStatus === 'delivered'" class="spinner-dot" />
          ✅ Đã giao thành công
        </button>

        <button
          v-if="currentStatus === 'pending' || currentStatus === 'confirmed'"
          type="button"
          class="chat-order-btn chat-order-btn--cancel"
          :disabled="loading"
          @click="handleUpdateStatus('cancelled', 'Đã hủy đơn')"
        >
          <span v-if="updatingStatus === 'cancelled'" class="spinner-dot" />
          ❌ Hủy đơn
        </button>

        <button
          type="button"
          class="chat-order-btn chat-order-btn--view"
          @click="viewDetail"
        >
          📋 Xem danh sách đơn
        </button>
      </div>
    </div>

    <!-- Customer actions -->
    <div v-else class="chat-order-card__actions">
      <div class="chat-order-card__buttons">
        <button
          v-if="currentStatus === 'pending'"
          type="button"
          class="chat-order-btn chat-order-btn--cancel"
          :disabled="loading"
          @click="handleUpdateStatus('cancelled', 'Đã hủy đơn')"
        >
          <span v-if="updatingStatus === 'cancelled'" class="spinner-dot" />
          ❌ Hủy đơn
        </button>

        <button
          type="button"
          class="chat-order-btn chat-order-btn--view"
          @click="viewDetail"
        >
          👁️ Xem chi tiết đơn
        </button>
      </div>
    </div>

    <!-- Feedback messages -->
    <p v-if="actionSuccessMsg" class="chat-order-card__msg chat-order-card__msg--success">
      ✓ {{ actionSuccessMsg }}
    </p>
    <p v-if="actionErrorMsg" class="chat-order-card__msg chat-order-card__msg--error">
      ⚠ {{ actionErrorMsg }}
    </p>
  </div>
</template>

<style scoped>
.chat-order-card {
  margin-top: 0.65rem;
  padding: 0.65rem 0.8rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #dbeafe;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
}

.chat-order-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px dashed #e2e8f0;
}

.chat-order-card__id {
  font-size: 0.78rem;
  font-weight: 700;
  color: #1e293b;
}

.chat-order-card__badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.chat-order-card__badge--pending {
  background: #fef3c7;
  color: #92400e;
}

.chat-order-card__badge--confirmed {
  background: #dbeafe;
  color: #1e40af;
}

.chat-order-card__badge--shipping {
  background: #e0e7ff;
  color: #3730a3;
}

.chat-order-card__badge--delivered {
  background: #dcfce7;
  color: #166534;
}

.chat-order-card__badge--cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.chat-order-card__actions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.chat-order-card__actions-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
}

.chat-order-card__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chat-order-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.28rem 0.6rem;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  cursor: pointer;
  transition: all 0.18s ease;
}

.chat-order-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.chat-order-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-order-btn--confirm {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}
.chat-order-btn--confirm:hover:not(:disabled) {
  background: #dbeafe;
}

.chat-order-btn--shipping {
  background: #eef2ff;
  border-color: #a5b4fc;
  color: #4338ca;
}
.chat-order-btn--shipping:hover:not(:disabled) {
  background: #e0e7ff;
}

.chat-order-btn--delivered {
  background: #f0fdf4;
  border-color: #86efac;
  color: #15803d;
}
.chat-order-btn--delivered:hover:not(:disabled) {
  background: #dcfce7;
}

.chat-order-btn--cancel {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #b91c1c;
}
.chat-order-btn--cancel:hover:not(:disabled) {
  background: #fee2e2;
}

.chat-order-btn--view {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #475569;
}

.chat-order-card__msg {
  margin: 0.4rem 0 0;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.3;
}

.chat-order-card__msg--success {
  color: #16a34a;
}

.chat-order-card__msg--error {
  color: #dc2626;
}

.spinner-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: dot-pulse 0.8s infinite ease-in-out;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
</style>
