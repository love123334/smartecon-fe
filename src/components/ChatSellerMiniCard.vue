<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { ChatSellerRef } from '@/types'
import { sellerTagStyle } from '@/utils/sellerTag'
import { useChatWidgetStore } from '@/stores/chatWidget'

const props = defineProps<{
  seller: ChatSellerRef
  /** Thu gọn khi bubble đã có card sản phẩm — tránh trùng lặp & chữ bị cắt */
  compact?: boolean
}>()

const router = useRouter()
const widget = useChatWidgetStore()

const avatarStyle = computed(() => sellerTagStyle(props.seller.sellerId))

const metaLine = computed(() => {
  const bits: string[] = []
  if (props.seller.shopLocation) bits.push(props.seller.shopLocation)
  if (props.seller.productCount) bits.push(`${props.seller.productCount} SP`)
  if (props.seller.avgRating) bits.push(`${props.seller.avgRating}★`)
  if (props.seller.totalSold) bits.push(`${props.seller.totalSold} đã bán`)
  return bits.join(' · ')
})

const categoryLine = computed(() => props.seller.topCategories?.slice(0, 3).join(', ') ?? '')

const sampleLine = computed(() =>
  props.seller.sampleProducts?.slice(0, 2).map((p) => p.name).join(', ') ?? '',
)

function openShop() {
  widget.hide()
  const q = props.seller.shopName.trim()
  if (props.seller.sampleProducts?.[0]?.id) {
    void router.push(`/products/${props.seller.sampleProducts[0].id}`)
    return
  }
  void router.push({ path: '/search', query: { q } })
}
</script>

<template>
  <button
    type="button"
    class="chat-seller-card"
    :class="{ 'chat-seller-card--compact': compact }"
    :title="seller.shopName"
    @click="openShop"
  >
    <div class="chat-seller-card__avatar" :style="avatarStyle">
      {{ seller.avatarInitial ?? seller.shopName.charAt(0).toUpperCase() }}
    </div>
    <div class="chat-seller-card__body">
      <div class="chat-seller-card__head">
        <p class="chat-seller-card__name">{{ seller.shopName }}</p>
        <span v-if="seller.tagCode" class="chat-seller-card__tag">{{ seller.tagCode }}</span>
      </div>
      <p v-if="metaLine" class="chat-seller-card__meta">{{ metaLine }}</p>
      <template v-if="!compact">
        <p v-if="categoryLine" class="chat-seller-card__categories">Danh mục: {{ categoryLine }}</p>
        <p v-if="sampleLine" class="chat-seller-card__samples">Tiêu biểu: {{ sampleLine }}</p>
      </template>
      <p
        v-if="seller.showContact && (seller.sellerEmail || seller.sellerPhone)"
        class="chat-seller-card__contact"
      >
        <span v-if="seller.sellerEmail">{{ seller.sellerEmail }}</span>
        <span v-if="seller.sellerEmail && seller.sellerPhone"> · </span>
        <span v-if="seller.sellerPhone">{{ seller.sellerPhone }}</span>
      </p>
    </div>
  </button>
</template>

<style scoped>
.chat-seller-card {
  display: flex;
  gap: 0.65rem;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #fff;
  color: inherit;
  overflow: hidden;
  box-sizing: border-box;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition:
    border-color var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1)),
    transform var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1));
}

.chat-seller-card--compact {
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
}

.chat-seller-card:hover {
  border-color: hsl(var(--seller-hue, 210) 45% 55%);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.chat-seller-card__avatar {
  flex: 0 0 52px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.15rem;
  font-weight: 800;
  border: 1px solid hsl(var(--seller-hue, 210) 35% 72%);
}

.chat-seller-card--compact .chat-seller-card__avatar {
  flex-basis: 40px;
  width: 40px;
  height: 40px;
  font-size: 0.95rem;
}

.chat-seller-card__body {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.chat-seller-card__head {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  min-width: 0;
}

.chat-seller-card__name {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 750;
  line-height: 1.3;
  min-width: 0;
  flex: 1 1 auto;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.chat-seller-card__tag {
  flex: 0 0 auto;
  font-size: 0.58rem;
  font-weight: 700;
  padding: 0.08rem 0.35rem;
  border-radius: 999px;
  border: 1px solid hsl(var(--seller-hue, 210) 35% 72%);
  background: hsl(var(--seller-hue, 210) 42% 92%);
  color: hsl(var(--seller-hue, 210) 45% 28%);
  margin-top: 0.05rem;
}

.chat-seller-card__meta {
  margin: 0;
  font-size: 0.68rem;
  color: var(--slate-600);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-seller-card__categories,
.chat-seller-card__samples {
  margin: 0;
  font-size: 0.64rem;
  color: var(--slate-500);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chat-seller-card__contact {
  margin: 0.1rem 0 0;
  font-size: 0.63rem;
  color: var(--slate-700);
  word-break: break-word;
}
</style>
