<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { productApi, formatVnd } from '@/api/services'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const products = ref<Product[]>([])

onMounted(async () => {
  if (auth.user) {
    products.value = await productApi.list({ sellerId: auth.user.backendId ?? auth.user.id })
  }
})

function stockLevel(stock: number) {
  if (stock < 10) return 'low'
  if (stock < 25) return 'warn'
  return 'ok'
}
</script>

<template>
  <div>
    <h1 class="page-title">Tồn kho</h1>
    <div class="table-wrap card">
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
