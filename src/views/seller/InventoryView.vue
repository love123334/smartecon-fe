<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { productApi, formatVnd } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const products = ref<Product[]>([])
const loading = ref(true)
const error = ref('')

onMounted(() => {
  void loadProducts()
})

async function loadProducts() {
  if (!auth.user) {
    loading.value = false
    error.value = 'Cần đăng nhập seller để xem tồn kho.'
    return
  }
  loading.value = true
  error.value = ''
  try {
    products.value = await productApi.list({
      sellerId: auth.user.backendId ?? auth.user.id,
      withStock: false,
    })
  } catch (e) {
    products.value = []
    error.value = e instanceof Error ? e.message : 'Không tải được tồn kho.'
  } finally {
    loading.value = false
  }
}

function stockLevel(stock: number) {
  if (stock < 10) return 'low'
  if (stock < 25) return 'warn'
  return 'ok'
}
</script>

<template>
  <div>
    <h1 class="page-title">Tồn kho</h1>

    <p v-if="loading" class="muted" role="status">Đang tải tồn kho…</p>

    <div v-else-if="error" class="card" role="alert" style="border-color: #fecaca; background: #fef2f2">
      <p style="margin: 0 0 0.75rem; color: #b91c1c; font-weight: 600">{{ error }}</p>
      <button type="button" class="btn btn-outline btn-sm" @click="loadProducts">Thử lại</button>
    </div>

    <div v-else-if="!products.length" class="card" role="status">
      <p class="muted" style="margin: 0">Chưa có sản phẩm nào trong kho của bạn.</p>
    </div>

    <div v-else class="table-wrap card">
      <table class="data">
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th>Danh mục</th>
            <th>Tồn</th>
            <th>Đã bán</th>
            <th>Giá</th>
            <th>Cảnh báo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id">
            <td>{{ p.name }}</td>
            <td>{{ p.category }}</td>
            <td>{{ p.stock }}</td>
            <td>{{ p.soldCount }}</td>
            <td>{{ formatVnd(p.price) }}</td>
            <td>
              <span v-if="stockLevel(p.stock) === 'low'" class="badge badge-cancelled">
                Sắp hết
              </span>
              <span v-else-if="stockLevel(p.stock) === 'warn'" class="badge badge-pending">
                Thấp
              </span>
              <span v-else class="badge badge-delivered">Ổn</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
