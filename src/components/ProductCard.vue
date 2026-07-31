<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Product } from '@/types'
import { formatVnd, getDiscountPercent, productApi } from '@/api/services'
import SellerShopTag from '@/components/SellerShopTag.vue'

const props = defineProps<{
  product: Product
  showAdd?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  add: [id: string]
}>()

const previewOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<Product | null>(null)
const activeImage = ref(props.product.imageUrl)

const discount = computed(() => getDiscountPercent(props.product))
const isNew = computed(() => props.product.soldCount < 40)
const display = computed(() => detail.value ?? props.product)

const gallery = computed(() => {
  const raw = [
    ...(display.value.imageUrls ?? []),
    display.value.imageUrl,
    props.product.imageUrl,
  ].filter((u): u is string => Boolean(u?.trim()))

  const unique: string[] = []
  for (const url of raw) {
    if (!unique.includes(url)) unique.push(url)
  }

  const real = unique.filter((u) => !/picsum\.photos/i.test(u))
  return (real.length >= 2 ? real : unique).slice(0, 4)
})

const blurb = computed(() => {
  const d = display.value.description?.trim()
  if (d) return d.length > 96 ? `${d.slice(0, 96)}…` : d
  return `${display.value.category} · ${display.value.rating.toFixed(1)}★ · đã bán ${display.value.soldCount}`
})

const stockLabel = computed(() => {
  const s = display.value.stock
  if (s == null || s <= 0) return 'Liên hệ / xem chi tiết'
  if (s <= 5) return `Sắp hết · còn ${s}`
  return `Còn ${s} sản phẩm`
})

function starDisplay(rating: number) {
  const full = Math.min(5, Math.max(0, Math.round(rating)))
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

let hoverTimer: ReturnType<typeof setTimeout> | null = null
let leaveTimer: ReturnType<typeof setTimeout> | null = null
let fetchSeq = 0

watch(
  () => props.product.id,
  () => {
    detail.value = null
    activeImage.value = props.product.imageUrl
    previewOpen.value = false
  },
)

function canHoverPreview() {
  if (props.compact) return false
  if (typeof window === 'undefined') return true
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function clearTimers() {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = null
  }
}

async function loadDetail() {
  if (detail.value || detailLoading.value) return
  const seq = ++fetchSeq
  detailLoading.value = true
  try {
    const p = await productApi.getById(props.product.id, { withStock: false })
    if (seq !== fetchSeq || !p) return
    detail.value = p
    const urls = p.imageUrls?.filter(Boolean) ?? []
    if (urls.length && !urls.includes(activeImage.value)) {
      activeImage.value = urls[0] ?? p.imageUrl
    }
  } catch {
    /* keep summary */
  } finally {
    if (seq === fetchSeq) detailLoading.value = false
  }
}

function onEnter() {
  if (!canHoverPreview()) return
  clearTimers()
  hoverTimer = setTimeout(() => {
    previewOpen.value = true
    void loadDetail()
  }, 140)
}

function onLeave() {
  clearTimers()
  leaveTimer = setTimeout(() => {
    previewOpen.value = false
  }, 120)
}

function pickImage(url: string, e?: Event) {
  e?.preventDefault()
  e?.stopPropagation()
  activeImage.value = url
}

function onAdd(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  emit('add', props.product.id)
}

onUnmounted(() => {
  clearTimers()
  fetchSeq += 1
})
</script>

<template>
  <article
    class="card product-card product-card--mkt product-card--elegant"
    :class="{
      'product-card--compact': compact,
      'product-card--preview-open': previewOpen,
    }"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <div class="product-card__media">
      <RouterLink :to="`/products/${product.id}`" class="product-card__img-link">
        <img
          :src="activeImage || product.imageUrl"
          :alt="product.name"
          loading="lazy"
          decoding="async"
        />
      </RouterLink>

      <div class="product-card__badges">
        <span v-if="isNew" class="product-card__new">Mới</span>
        <span v-if="product.isFlashSale" class="product-card__sale">Sale</span>
        <span v-if="discount > 0" class="product-card__discount">-{{ discount }}%</span>
      </div>

      <div class="product-card__seller">
        <SellerShopTag :product="product" size="sm" />
      </div>

      <button type="button" class="product-card__wish" aria-label="Thêm vào yêu thích">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
    </div>

    <!-- Mini panel dưới ảnh: không đè nút giỏ -->
    <div
      v-if="!compact"
      class="product-card__mini"
      :class="{ 'product-card__mini--open': previewOpen }"
      @mouseenter="onEnter"
    >
      <div class="product-card__mini-thumbs">
        <button
          v-for="(url, i) in gallery"
          :key="`${url}-${i}`"
          type="button"
          class="product-card__mini-thumb"
          :class="{ 'product-card__mini-thumb--active': activeImage === url }"
          :aria-label="`Ảnh ${i + 1}`"
          @click="pickImage(url, $event)"
        >
          <img :src="url" alt="" loading="lazy" decoding="async" />
        </button>
      </div>
      <p class="product-card__mini-blurb">
        <span v-if="detailLoading" class="product-card__mini-loading">Đang tải chi tiết…</span>
        <template v-else>{{ blurb }}</template>
      </p>
      <div class="product-card__mini-meta">
        <span>{{ display.category }}</span>
        <span>{{ stockLabel }}</span>
      </div>
    </div>

    <div class="body">
      <p class="product-card__stars" :aria-label="`${product.rating} sao`">
        <span aria-hidden="true">{{ starDisplay(product.rating) }}</span>
      </p>
      <h3>
        <RouterLink :to="`/products/${product.id}`">{{ product.name }}</RouterLink>
      </h3>
      <div class="price-row">
        <p class="price">{{ formatVnd(product.price) }}</p>
        <span
          v-if="product.originalPrice && product.originalPrice > product.price"
          class="price-original"
        >
          {{ formatVnd(product.originalPrice) }}
        </span>
      </div>

      <div v-if="showAdd" class="product-card__actions-row">
        <button type="button" class="product-card__cart-btn" @click="onAdd">
          Thêm vào giỏ
        </button>
        <RouterLink :to="`/products/${product.id}`" class="product-card__detail-btn">
          Chi tiết
        </RouterLink>
      </div>
    </div>
  </article>
</template>
