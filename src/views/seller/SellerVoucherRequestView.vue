<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatVnd, voucherApi } from '@/api/services'
import type { SellerVoucherRequestPayload, VoucherRequest } from '@/api/real/vouchers'
import { useAuthStore } from '@/stores/auth'
import { loadSellerCatalogForDss } from '@/utils/sellerCatalog'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const requests = ref<VoucherRequest[]>([])
const products = ref<Array<{ id: string; name: string }>>([])
const loading = ref(true)
const error = ref('')
const success = ref('')
const submitting = ref(false)

const form = ref<SellerVoucherRequestPayload>({
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  appliesTo: 'ALL_PRODUCTS',
  minimumOrderAmount: 0,
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
  productIds: [],
})

const selectedProducts = ref<string[]>([])

onMounted(async () => {
  loading.value = true
  try {
    const sellerKey = auth.user?.backendId ?? auth.user?.id
    const [reqs, catalog] = await Promise.all([
      voucherApi.listSellerRequests(),
      loadSellerCatalogForDss({ sellerId: sellerKey, withStock: false }),
    ])
    requests.value = reqs
    products.value = catalog.products.map((p) => ({ id: p.id, name: p.name }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được dữ liệu'
  } finally {
    loading.value = false
  }
})

async function submit() {
  submitting.value = true
  error.value = ''
  success.value = ''
  try {
    await voucherApi.createSellerRequest({
      ...form.value,
      code: form.value.code.trim().toUpperCase(),
      startsAt: new Date(form.value.startsAt).toISOString(),
      endsAt: new Date(form.value.endsAt).toISOString(),
      productIds:
        form.value.appliesTo === 'SELECTED_PRODUCTS'
          ? selectedProducts.value.map(Number)
          : [],
    })
    success.value = 'Đã gửi yêu cầu — manager sẽ duyệt và mã sẽ hiện trên shop của bạn.'
    requests.value = await voucherApi.listSellerRequests()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Gửi yêu cầu thất bại'
  } finally {
    submitting.value = false
  }
}

function statusLabel(s: VoucherRequest['status']) {
  if (s === 'PENDING') return 'Chờ duyệt'
  if (s === 'APPROVED') return 'Đã duyệt'
  return 'Từ chối'
}

function discountLabel(r: VoucherRequest) {
  return r.discountType === 'PERCENTAGE' ? `${r.discountValue}%` : formatVnd(r.discountValue)
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Người bán"
      title="Yêu cầu voucher"
      lead="Gửi đề xuất mã giảm giá cho manager duyệt — sau khi duyệt, khách nhập mã sẽ được giảm trên shop bạn."
    />

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="success" class="muted">{{ success }}</p>

    <section v-if="!loading" class="card" style="margin-bottom: 1rem">
      <h2 class="card-title">Gửi yêu cầu mới</h2>
      <div style="display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))">
        <label>Mã đề xuất <input v-model="form.code" class="input" placeholder="SHOP15" /></label>
        <label>Tên chiến dịch <input v-model="form.name" class="input" /></label>
        <label>Loại
          <select v-model="form.discountType" class="input">
            <option value="PERCENTAGE">%</option>
            <option value="FIXED">VND</option>
          </select>
        </label>
        <label>Giá trị <input v-model.number="form.discountValue" type="number" min="1" class="input" /></label>
        <label>Phạm vi SP
          <select v-model="form.appliesTo" class="input">
            <option value="ALL_PRODUCTS">Tất cả SP shop</option>
            <option value="SELECTED_PRODUCTS">SP chọn</option>
          </select>
        </label>
        <label>ĐH tối thiểu <input v-model.number="form.minimumOrderAmount" type="number" min="0" class="input" /></label>
      </div>
      <div v-if="form.appliesTo === 'SELECTED_PRODUCTS'" style="margin-top: 0.75rem">
        <span>Chọn sản phẩm</span>
        <select v-model="selectedProducts" multiple class="input" style="min-height: 6rem">
          <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <label style="display: block; margin-top: 0.75rem">
        Mô tả / lý do
        <textarea v-model="form.description" class="input" rows="2" placeholder="Flash sale cuối tuần, giảm 15% cho danh mục cà phê…" />
      </label>
      <button type="button" class="btn btn-primary" style="margin-top: 0.75rem" :disabled="submitting" @click="submit">
        {{ submitting ? 'Đang gửi…' : 'Gửi manager duyệt' }}
      </button>
    </section>

    <section v-if="!loading" class="card">
      <h2 class="card-title">Lịch sử yêu cầu</h2>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr><th>Mã</th><th>Giảm</th><th>Trạng thái</th><th>Ghi chú manager</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in requests" :key="r.id">
              <td><strong>{{ r.code }}</strong></td>
              <td>{{ discountLabel(r) }}</td>
              <td>{{ statusLabel(r.status) }}</td>
              <td>{{ r.managerNote || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
