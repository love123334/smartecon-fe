<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { productApi, categoryApi } from '@/api/services'
import type { Category } from '@/api/real/categories'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import ProductCard from '@/components/ProductCard.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const auth = useAuthStore()
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const editing = ref<Product | null>(null)
const showForm = ref(false)
const error = ref('')
const saving = ref(false)
const uploading = ref(false)
const loading = ref(false)
const newCategoryName = ref('')
const creatingCategory = ref(false)
const q = ref('')
const sort = ref('newest')
const form = ref({
  name: '',
  description: '',
  price: 0,
  stock: 0,
  categoryId: '',
  imageUrl: '',
  imagePublicId: '',
})

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  let list = products.value
  if (term) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term),
    )
  }
  if (sort.value === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
  else if (sort.value === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
  else if (sort.value === 'stock') list = [...list].sort((a, b) => a.stock - b.stock)
  else list = [...list].sort((a, b) => Number(b.id) - Number(a.id) || a.name.localeCompare(b.name))
  return list
})

async function loadCategories() {
  categories.value = await categoryApi.list(true)
}

async function load() {
  if (!auth.user) return
  loading.value = true
  error.value = ''
  try {
    const sellerKey = auth.user.backendId ?? auth.user.id
    products.value = await productApi.list({ sellerId: sellerKey, withStock: true })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được sản phẩm'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadCategories()
  await load()
})

async function createCategory() {
  const name = newCategoryName.value.trim()
  if (!name) {
    error.value = 'Nhập tên danh mục mới'
    return
  }
  creatingCategory.value = true
  error.value = ''
  try {
    const created = await categoryApi.create(name)
    await loadCategories()
    form.value.categoryId = created.id
    newCategoryName.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tạo được danh mục'
  } finally {
    creatingCategory.value = false
  }
}

function startCreate() {
  editing.value = null
  showForm.value = true
  error.value = ''
  form.value = {
    name: '',
    description: '',
    price: 0,
    stock: 0,
    categoryId: categories.value[0]?.id ?? '',
    imageUrl: '',
    imagePublicId: '',
  }
}

function startEdit(p: Product) {
  editing.value = p
  showForm.value = true
  error.value = ''
  const cat = categories.value.find(
    (c) => c.name.toLowerCase() === p.category.toLowerCase(),
  )
  form.value = {
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    categoryId: cat?.id ?? categories.value[0]?.id ?? '',
    imageUrl: p.imageUrl,
    imagePublicId: '',
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function onImagePick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  error.value = ''
  try {
    const uploaded = await productApi.uploadImage(file)
    form.value.imageUrl = uploaded.url
    form.value.imagePublicId = uploaded.publicId
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Upload thất bại'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function save() {
  if (!auth.user) return
  if (form.value.price <= 0) {
    error.value = 'Giá sản phẩm phải lớn hơn 0'
    return
  }
  if (!form.value.categoryId) {
    error.value = 'Vui lòng chọn danh mục'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const cat = categories.value.find((c) => c.id === form.value.categoryId)
    const imageUrl =
      form.value.imageUrl ||
      `https://picsum.photos/seed/${encodeURIComponent(form.value.name || 'sp')}/400/300`
    const imagePublicId =
      form.value.imagePublicId || `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    if (editing.value) {
      await productApi.update(editing.value.id, {
        name: form.value.name,
        description: form.value.description,
        price: form.value.price,
        category: cat?.name ?? editing.value.category,
        categoryId: Number(form.value.categoryId),
        imageUrl,
        stock: form.value.stock,
      })
    } else {
      await productApi.create(auth.user.backendId ?? auth.user.id, {
        name: form.value.name,
        description: form.value.description,
        price: form.value.price,
        stock: form.value.stock,
        category: cat?.name ?? 'Khác',
        categoryId: Number(form.value.categoryId),
        imageUrl,
        imagePublicId,
        shopName: auth.user.fullName,
        shopLocation: 'TP.HCM',
      })
    }
    editing.value = null
    showForm.value = false
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không lưu được sản phẩm'
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  if (!confirm('Xóa sản phẩm?')) return
  error.value = ''
  try {
    await productApi.remove(id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không xóa được sản phẩm'
  }
}
</script>

<template>
  <div class="shop-page shop-page--catalog seller-products">
    <div class="container seller-products__inner">
      <header class="seller-products__header">
        <div>
          <h1 class="page-title" style="margin-bottom: 0.25rem">Quản lý sản phẩm</h1>
          <p class="seller-products__lead">
            Danh sách hiển thị giống trang cửa hàng — chỉnh sửa trực tiếp từ từng thẻ sản phẩm.
          </p>
        </div>
        <button type="button" class="btn btn-primary btn-interactive" @click="startCreate">
          + Thêm sản phẩm
        </button>
      </header>

      <p v-if="error && !showForm" class="elegant-alert elegant-alert--error">{{ error }}</p>

      <form v-if="showForm" class="card form-edit" @submit.prevent="save">
        <h2>{{ editing ? 'Sửa' : 'Thêm' }} sản phẩm</h2>
        <p v-if="error" class="elegant-alert elegant-alert--error">{{ error }}</p>
        <div class="form-group">
          <label>Tên</label>
          <input v-model="form.name" required />
        </div>
        <div class="form-group">
          <label>Mô tả</label>
          <textarea v-model="form.description" rows="3" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Giá (VND)</label>
            <input v-model.number="form.price" type="number" min="1" required />
          </div>
          <div class="form-group">
            <label>Tồn kho</label>
            <input v-model.number="form.stock" type="number" min="0" required />
          </div>
        </div>
        <div class="form-group">
          <label>Danh mục</label>
          <select v-model="form.categoryId" required>
            <option disabled value="">Chọn danh mục</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <div class="cat-create">
            <input
              v-model="newCategoryName"
              class="input"
              placeholder="Hoặc tạo danh mục mới…"
            />
            <button
              type="button"
              class="btn btn-outline btn-sm"
              :disabled="creatingCategory"
              @click="createCategory"
            >
              {{ creatingCategory ? 'Đang tạo…' : '+ Thêm danh mục' }}
            </button>
          </div>
          <p v-if="!categories.length" class="hint">
            Chưa có danh mục trên server — tạo thủ công ở đây (seller/admin).
          </p>
        </div>
        <div class="form-group">
          <label>Ảnh sản phẩm {{ uploading ? '(đang upload…)' : '' }}</label>
          <input type="file" accept="image/*" :disabled="uploading" @change="onImagePick" />
          <p class="hint">
            Nên upload ảnh (Cloudinary). Nếu bỏ trống sẽ dùng ảnh placeholder + publicId tự sinh.
          </p>
          <img v-if="form.imageUrl" :src="form.imageUrl" alt="Preview" class="preview" />
        </div>
        <div class="actions">
          <button type="submit" class="btn btn-primary" :disabled="saving || uploading">
            {{ saving ? 'Đang lưu…' : 'Lưu vào database' }}
          </button>
          <button type="button" class="btn btn-outline" @click="showForm = false">Hủy</button>
        </div>
      </form>

      <div class="shop-main seller-products__main">
        <form class="shop-search-inline" role="search" @submit.prevent>
          <label for="seller-prod-q" class="sr-only">Từ khóa</label>
          <input
            id="seller-prod-q"
            v-model="q"
            type="search"
            placeholder="Tìm sản phẩm của bạn..."
          />
        </form>

        <div class="shop-toolbar">
          <h2 class="shop-toolbar__title">Sản phẩm của shop</h2>
          <label class="shop-sort">
            <span class="sr-only">Sắp xếp</span>
            <select v-model="sort">
              <option value="newest">Mới nhất</option>
              <option value="price-asc">Giá thấp → cao</option>
              <option value="price-desc">Giá cao → thấp</option>
              <option value="stock">Tồn kho thấp trước</option>
            </select>
          </label>
        </div>

        <LoadingSpinner v-if="loading" label="Đang tải sản phẩm..." />
        <EmptyState
          v-else-if="!filtered.length"
          icon="📦"
          title="Chưa có sản phẩm"
          :description="
            q
              ? `Không tìm thấy «${q}» trong shop của bạn`
              : 'Thêm sản phẩm mới để hiển thị trên cửa hàng'
          "
        >
          <button
            v-if="!q"
            type="button"
            class="btn btn-primary btn-sm btn-interactive"
            @click="startCreate"
          >
            + Thêm sản phẩm
          </button>
        </EmptyState>
        <template v-else>
          <p class="shop-result-count">{{ filtered.length }} sản phẩm</p>
          <div class="mkt-grid mkt-grid--shop grid-stagger">
            <div v-for="p in filtered" :key="p.id" class="seller-product-tile">
              <ProductCard :product="p" />
              <div class="seller-product-tile__bar">
                <span class="seller-product-tile__stock" :class="{ 'is-low': p.stock <= 5 }">
                  Tồn: {{ p.stock }}
                </span>
                <div class="seller-product-tile__actions">
                  <button
                    type="button"
                    class="btn btn-sm btn-outline btn-interactive"
                    @click="startEdit(p)"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-interactive seller-product-tile__delete"
                    @click="remove(p.id)"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.seller-products__inner {
  padding-top: 1.5rem;
  padding-bottom: 2.5rem;
}

.seller-products__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.seller-products__lead {
  margin: 0;
  color: var(--slate-500, #64748b);
  font-size: 0.95rem;
  max-width: 36rem;
}

.seller-products__main {
  margin-top: 1.25rem;
}

.form-edit {
  margin-top: 0.5rem;
  padding: 1.25rem;
  max-width: 560px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.preview {
  display: block;
  margin-top: 0.5rem;
  max-width: 160px;
  border-radius: 8px;
}

.hint {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  color: var(--slate-500, #64748b);
}

.cat-create {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.cat-create .input {
  flex: 1;
  min-width: 140px;
}

.seller-product-tile {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.seller-product-tile :deep(.product-card) {
  flex: 1;
}

.seller-product-tile__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.55rem;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  background: color-mix(in srgb, var(--slate-100, #f1f5f9) 88%, white);
  border: 1px solid color-mix(in srgb, var(--slate-200, #e2e8f0) 80%, transparent);
}

.seller-product-tile__stock {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--slate-600, #475569);
}

.seller-product-tile__stock.is-low {
  color: #c2410c;
}

.seller-product-tile__actions {
  display: flex;
  gap: 0.35rem;
}

.seller-product-tile__delete {
  color: #b91c1c;
  border: 1px solid color-mix(in srgb, #b91c1c 28%, transparent);
  background: #fff;
}

.seller-product-tile__delete:hover {
  background: color-mix(in srgb, #b91c1c 8%, white);
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .seller-product-tile__bar {
    flex-direction: column;
    align-items: stretch;
  }

  .seller-product-tile__actions {
    justify-content: stretch;
  }

  .seller-product-tile__actions .btn {
    flex: 1;
  }
}
</style>
