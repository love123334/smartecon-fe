<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { productApi, categoryApi, formatVnd } from '@/api/services'
import type { Category } from '@/api/real/categories'
import type { Product } from '@/types'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const editing = ref<Product | null>(null)
const showForm = ref(false)
const error = ref('')
const saving = ref(false)
const uploading = ref(false)
const newCategoryName = ref('')
const creatingCategory = ref(false)
const form = ref({
  name: '',
  description: '',
  price: 0,
  stock: 0,
  categoryId: '',
  imageUrl: '',
  imagePublicId: '',
})

async function loadCategories() {
  categories.value = await categoryApi.list(true)
}

async function load() {
  if (!auth.user) return
  const sellerKey = auth.user.backendId ?? auth.user.id
  products.value = await productApi.list({ sellerId: sellerKey, withStock: true })
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
  if (confirm('Xóa sản phẩm?')) {
    await productApi.remove(id)
    await load()
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">Quản lý sản phẩm</h1>
    <button type="button" class="btn btn-primary" @click="startCreate">+ Thêm SP</button>
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
      <div class="form-group">
        <label>Giá (VND)</label>
        <input v-model.number="form.price" type="number" min="1" required />
      </div>
      <div class="form-group">
        <label>Tồn kho</label>
        <input v-model.number="form.stock" type="number" min="0" required />
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
        <p class="hint">Nên upload ảnh (Cloudinary). Nếu bỏ trống sẽ dùng ảnh placeholder + publicId tự sinh.</p>
        <img v-if="form.imageUrl" :src="form.imageUrl" alt="Preview" class="preview" />
      </div>
      <div class="actions">
        <button type="submit" class="btn btn-primary" :disabled="saving || uploading">
          {{ saving ? 'Đang lưu…' : 'Lưu vào database' }}
        </button>
        <button type="button" class="btn btn-outline" @click="showForm = false">Hủy</button>
      </div>
    </form>

    <div class="table-wrap card" style="margin-top: 1rem">
      <table class="data">
        <thead>
          <tr>
            <th>Ảnh</th>
            <th>Tên</th>
            <th>Giá</th>
            <th>Tồn</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id">
            <td><img :src="p.imageUrl" alt="" width="48" height="48" style="object-fit: cover; border-radius: 6px" /></td>
            <td>{{ p.name }}</td>
            <td>{{ formatVnd(p.price) }}</td>
            <td>{{ p.stock }}</td>
            <td>
              <button type="button" class="btn btn-sm btn-outline" @click="startEdit(p)">Sửa</button>
              <button type="button" class="btn btn-sm" @click="remove(p.id)">Xóa</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!products.length" class="empty">Chưa có sản phẩm — thêm mới để lưu vào DB.</p>
    </div>
  </div>
</template>

<style scoped>
.form-edit {
  margin-top: 1rem;
  padding: 1.25rem;
  max-width: 520px;
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
</style>
