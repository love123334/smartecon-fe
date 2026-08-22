<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import {
  LOOKER_EMBED_HEIGHT_PX,
  LOOKER_EMBED_HEIGHT_MOBILE_PX,
  lookerEmbedSrc,
} from '@/constants/lookerStudio'

const props = withDefaults(
  defineProps<{
    src: string
    title?: string
    minHeight?: number
  }>(),
  {
    title: 'Looker Studio',
    minHeight: LOOKER_EMBED_HEIGHT_PX,
  },
)

const emit = defineEmits<{
  load: []
  fail: []
}>()

const frameRef = ref<HTMLIFrameElement | null>(null)
const frameHeight = ref(props.minHeight)
const loaded = ref(false)
const failed = ref(false)
let failTimer: ReturnType<typeof setTimeout> | null = null

function clampHeight(h: number) {
  const mobileMin =
    typeof window !== 'undefined' && window.innerWidth <= 800
      ? LOOKER_EMBED_HEIGHT_MOBILE_PX
      : props.minHeight
  return Math.min(Math.max(Math.round(h), mobileMin), 2400)
}

function onMessage(event: MessageEvent) {
  if (event.source !== frameRef.value?.contentWindow) return
  const origin = String(event.origin || '')
  if (
    !origin.includes('lookerstudio.google.com') &&
    !origin.includes('datastudio.google.com')
  ) {
    return
  }

  const data = event.data
  let next: number | null = null

  if (typeof data === 'number' && Number.isFinite(data)) {
    next = data
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (typeof obj.height === 'number') next = obj.height
    else if (Array.isArray(obj) && obj[0] && typeof obj[0] === 'object') {
      const first = obj[0] as Record<string, unknown>
      if (typeof first.height === 'number') next = first.height
    }
  }

  if (next != null && next > 0) {
    frameHeight.value = clampHeight(next)
  }
}

function onLoad() {
  loaded.value = true
  failed.value = false
  if (failTimer) {
    clearTimeout(failTimer)
    failTimer = null
  }
  emit('load')
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  failTimer = setTimeout(() => {
    if (!loaded.value) {
      failed.value = true
      emit('fail')
    }
  }, 18_000)
})

onUnmounted(() => {
  window.removeEventListener('message', onMessage)
  if (failTimer) clearTimeout(failTimer)
})

const embedSrc = lookerEmbedSrc(props.src)
</script>

<template>
  <div
    class="looker-embed"
    :style="{ '--looker-h': `${frameHeight}px` }"
  >
    <p v-if="!loaded && !failed" class="looker-embed__loading muted" role="status">
      Đang tải báo cáo Looker Studio…
    </p>
    <div v-if="failed && !loaded" class="looker-embed__fallback" role="status">
      <p>Không nhúng được Looker trong trang (chặn iframe / mạng).</p>
      <a class="btn btn-outline btn-sm" :href="src" target="_blank" rel="noopener noreferrer">
        Mở báo cáo đầy đủ
      </a>
    </div>
    <iframe
      ref="frameRef"
      class="looker-embed__frame"
      :title="title"
      :src="embedSrc"
      loading="lazy"
      scrolling="no"
      referrerpolicy="no-referrer-when-downgrade"
      allowfullscreen
      @load="onLoad"
    />
  </div>
</template>

<style scoped>
.looker-embed {
  position: relative;
  width: 100%;
  height: var(--looker-h, 720px);
  overflow: hidden;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid var(--line, #e2e8f0);
}

.looker-embed__loading,
.looker-embed__fallback {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  text-align: center;
  background: rgba(248, 250, 252, 0.92);
}

.looker-embed__frame {
  display: block;
  width: 100%;
  height: var(--looker-h, 720px);
  border: 0;
  overflow: hidden;
}
</style>
