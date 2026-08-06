<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { productApi, categoryApi } from '@/api/services'
import type { Category } from '@/api/real/categories'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'
import ProductCard from '@/components/ProductCard.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const MIN_IMAGES = 3
const MAX_IMAGES = 5

interface FormImage {
  url: string
  publicId: string
}

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
  images: [] as FormImage[],
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

const canAddMoreImages = computed(() => form.value.images.length < MAX_IMAGES)

async function loadCategories() {
  categories.value = await categoryApi.list(true)
}

async function load() {
  if (!auth.user) return
  loading.value = true
  error.value = ''
  try {
    const sellerKey = auth.user.backendId ?? auth.user.id
    products.value = await productApi.list({ sellerId: sellerKey, withStock: false })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được sản phẩm'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void Promise.all([loadCategories(), load()])
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
    images: [],
  }
}

function startEdit(p: Product) {
  editing.value = p
  showForm.value = true
  error.value = ''
  void hydrateEditForm(p)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function hydrateEditForm(p: Product) {
  const cat = categories.value.find(
    (c) => c.name.toLowerCase() === p.category.toLowerCase(),
  )
  // List API omits description — fetch detail so edit form shows/saves mô tả correctly
  const detail = await productApi.getById(p.id).catch(() => null)
  const src = detail ?? p
  const urls = (src.imageUrls?.length ? src.imageUrls : [src.imageUrl])
    .filter(Boolean)
    .slice(0, MAX_IMAGES)
  form.value = {
    name: src.name,
    description: src.description ?? '',
    price: src.price,
    stock: src.stock,
    categoryId: cat?.id ?? categories.value[0]?.id ?? '',
    images: urls.map((url, i) => ({ url, publicId: `existing-${p.id}-${i}` })),
  }
}

async function onImagesPick(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  if (!files.length) return

  const room = MAX_IMAGES - form.value.images.length
  if (room <= 0) {
    error.value = `Tối đa ${MAX_IMAGES} ảnh mỗi sản phẩm`
    input.value = ''
    return
  }

  const selected = files.slice(0, room)
  uploading.value = true
  error.value = ''
  try {
    for (const file of selected) {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(`Ảnh «${file.name}» vượt 5MB`)
      }
      if (!file.type.startsWith('image/')) {
        throw new Error(`«${file.name}» không phải file ảnh`)
      }
      const uploaded = await productApi.uploadImage(file)
      form.value.images.push({
        url: uploaded.url,
        publicId: uploaded.publicId,
      })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Upload thất bại'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function removeImage(index: number) {
  form.value.images.splice(index, 1)
}

function setPrimary(index: number) {
  if (index <= 0 || index >= form.value.images.length) return
  const [img] = form.value.images.splice(index, 1)
  form.value.images.unshift(img)
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
  if (form.value.images.length > MAX_IMAGES) {
    error.value = `Tối đa ${MAX_IMAGES} ảnh`
    return
  }

  saving.value = true
  error.value = ''
  try {
    const cat = categories.value.find((c) => c.id === form.value.categoryId)
    const images = form.value.images.map((img, i) => ({
      imageUrl: img.url,
      publicId: img.publicId,
      isPrimary: i === 0,
    }))

    if (editing.value) {
      await productApi.update(editing.value.id, {
        name: form.value.name,
        description: form.value.description,
        price: form.value.price,
        category: cat?.name ?? editing.value.category,
        categoryId: Number(form.value.categoryId),
        stock: form.value.stock,
        images: images.length ? images : undefined,
        imageUrl: images[0]?.imageUrl,
        imagePublicId: images[0]?.publicId,
      })
    } else {
      await productApi.create(auth.user.backendId ?? auth.user.id, {
        name: form.value.name,
        description: form.value.description,
        price: form.value.price,
        stock: form.value.stock,
        category: cat?.name ?? 'Khác',
        categoryId: Number(form.value.categoryId),
        images: images.length ? images : undefined,
        imageUrl: images[0]?.imageUrl,
        imagePublicId: images[0]?.publicId,
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
  const prev = products.value
  products.value = products.value.filter((p) => p.id !== id)
  try {
    await productApi.remove(id)
    await load()
  } catch (e) {
    products.value = prev
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
          <label>
            Ảnh sản phẩm ({{ form.images.length }}/{{ MAX_IMAGES }})
            {{ uploading ? '— đang upload…' : '' }}
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            :disabled="uploading || !canAddMoreImages"
            @change="onImagesPick"
          />
          <p class="hint">
            Upload <strong>{{ MIN_IMAGES }}–{{ MAX_IMAGES }} ảnh</strong> (≤5MB/ảnh). Ảnh đầu là ảnh
            chính. Có thể chọn nhiều file cùng lúc.
          </p>
          <div v-if="form.images.length" class="img-grid">
            <div v-for="(img, i) in form.images" :key="img.publicId + '-' + i" class="img-tile">
              <img :src="img.url" :alt="`Ảnh ${i + 1}`" />
              <span v-if="i === 0" class="img-tile__badge">Chính</span>
              <div class="img-tile__actions">
                <button
                  v-if="i > 0"
                  type="button"
                  class="btn btn-outline btn-sm"
                  @click="setPrimary(i)"
                >
                  Đặt chính
                </button>
                <button type="button" class="btn btn-sm img-tile__remove" @click="removeImage(i)">
                  Xóa
                </button>
              </div>
            </div>
          </div>
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
  max-width: 640px;
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

.img-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.65rem;
  margin-top: 0.75rem;
}

.img-tile {
  position: relative;
  border: 1px solid var(--slate-200, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.img-tile img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.img-tile__badge {
  position: absolute;
  top: 0.35rem;
  left: 0.35rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: #0f172a;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
}

.img-tile__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.35rem;
}

.img-tile__remove {
  color: #b91c1c;
  border: 1px solid #fecaca;
  background: #fff;
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
