<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Product } from '@/types'
import { formatVnd, getDiscountPercent, productApi } from '@/api/services'
import SellerShopTag from '@/components/SellerShopTag.vue'
import { productToDragPayload, SEDSP_PRODUCT_DRAG_MIME } from '@/api/chat/productCards'
import { useChatWidgetStore } from '@/stores/chatWidget'
import { handleProductImageError, repairProductImageUrl } from '@/utils/productImage'

const props = defineProps<{
  product: Product
  showAdd?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  add: [id: string]
}>()

const router = useRouter()
const previewOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<Product | null>(null)
const activeImage = ref(
  repairProductImageUrl(props.product.imageUrl, {
    seed: props.product.id,
    category: props.product.category,
  }),
)

const discount = computed(() => getDiscountPercent(props.product))
const isNew = computed(() => {
  const created = Date.parse(props.product.createdAt)
  if (!Number.isFinite(created)) return false
  const ageDays = (Date.now() - created) / (1000 * 60 * 60 * 24)
  return ageDays <= 21
})
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
    activeImage.value = repairProductImageUrl(props.product.imageUrl, {
      seed: props.product.id,
      category: props.product.category,
    })
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
    const urls = (p.imageUrls?.filter(Boolean) ?? []).map((u) =>
      repairProductImageUrl(u, { seed: p.id, category: p.category }),
    )
    if (urls.length && !urls.includes(activeImage.value)) {
      activeImage.value = urls[0] ?? repairProductImageUrl(p.imageUrl, { seed: p.id, category: p.category })
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
  }, 280)
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
  activeImage.value = repairProductImageUrl(url, {
    seed: props.product.id,
    category: props.product.category,
  })
}

function onImgError(e: Event) {
  handleProductImageError(e, gallery.value)
}

function onAdd(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  emit('add', props.product.id)
}

function goDetail(e?: Event) {
  e?.preventDefault()
  e?.stopPropagation()
  void router.push(`/products/${props.product.id}`)
}

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return
  const payload = productToDragPayload(props.product)
  e.dataTransfer.setData(SEDSP_PRODUCT_DRAG_MIME, payload)
  e.dataTransfer.setData('application/json', payload)
  e.dataTransfer.setData('text/plain', payload)
  e.dataTransfer.effectAllowed = 'copy'
  useChatWidgetStore().dragOver = false
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
    <div
      class="product-card__media"
      draggable="true"
      title="Kéo vào trợ lý để hỏi / so sánh"
      @dragstart="onDragStart"
    >
      <button type="button" class="product-card__img-link" :aria-label="`Xem ${product.name}`" @click="goDetail">
        <img
          :src="activeImage || product.imageUrl"
          :alt="product.name"
          class="img-fade"
          loading="lazy"
          decoding="async"
          draggable="false"
          @load="($event.target as HTMLImageElement).classList.add('is-loaded')"
          @error="onImgError"
        />
      </button>

      <div class="product-card__badges">
        <span v-if="isNew" class="product-card__new">Mới</span>
        <span v-if="product.isFlashSale || discount > 0" class="product-card__sale">Giảm giá</span>
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
          <img :src="url" alt="" loading="lazy" decoding="async" @error="onImgError" />
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
        <button type="button" class="product-card__title-btn" @click="goDetail">
          {{ product.name }}
        </button>
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
        <button type="button" class="product-card__detail-btn" @click="goDetail">
          Chi tiết
        </button>
      </div>
    </div>
  </article>
</template>
