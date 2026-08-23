<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  LOOKER_REPORT_HEIGHT_PX,
  LOOKER_REPORT_WIDTH_PX,
  lookerEmbedSrc,
} from '@/constants/lookerStudio'

const props = withDefaults(
  defineProps<{
    src: string
    title?: string
    reportWidth?: number
    reportHeight?: number
  }>(),
  {
    title: 'Looker Studio',
    reportWidth: LOOKER_REPORT_WIDTH_PX,
    reportHeight: LOOKER_REPORT_HEIGHT_PX,
  },
)

const emit = defineEmits<{
  load: []
  fail: []
}>()

const viewportRef = ref<HTMLElement | null>(null)
const frameRef = ref<HTMLIFrameElement | null>(null)
const naturalWidth = ref(props.reportWidth)
const naturalHeight = ref(props.reportHeight)
const containerWidth = ref(0)
const loaded = ref(false)
const failed = ref(false)
let failTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null

function parseLookerDimensions(data: unknown): { width?: number; height?: number } {
  if (typeof data === 'number' && Number.isFinite(data) && data > 0) {
    return { height: data }
  }

  if (typeof data === 'string') {
    const trimmed = data.trim()
    if (!trimmed) return {}
    try {
      return parseLookerDimensions(JSON.parse(trimmed))
    } catch {
      const asNum = Number(trimmed)
      if (Number.isFinite(asNum) && asNum > 0) return { height: asNum }
      return {}
    }
  }

  if (!data || typeof data !== 'object') return {}

  const obj = data as Record<string, unknown>
  const out: { width?: number; height?: number } = {}

  for (const key of ['height', 'pageHeight', 'reportHeight'] as const) {
    const v = obj[key]
    if (typeof v === 'number' && v > 0) out.height = v
  }
  for (const key of ['width', 'pageWidth', 'reportWidth'] as const) {
    const v = obj[key]
    if (typeof v === 'number' && v > 0) out.width = v
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const nested = parseLookerDimensions(item)
      if (nested.height) out.height = nested.height
      if (nested.width) out.width = nested.width
    }
    return out
  }

  const type = String(obj.type ?? obj.event ?? '')
  if (/height|page|resize|dimension|properties:changed|page:changed/i.test(type)) {
    if (typeof obj.height === 'number' && obj.height > 0) out.height = obj.height
  }

  return out
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

  const dims = parseLookerDimensions(event.data)
  if (dims.width && dims.width >= 640 && dims.width <= 2400) {
    naturalWidth.value = Math.round(dims.width)
  }
  if (dims.height && dims.height >= 400 && dims.height <= 4000) {
    naturalHeight.value = Math.round(dims.height)
  }
}

/** Stretch full width; height follows aspect ratio — khung vừa khít báo cáo. */
const scale = computed(() => {
  const cw = containerWidth.value || naturalWidth.value
  const nw = naturalWidth.value
  if (!cw || !nw) return 1
  return cw / nw
})

const fitHeight = computed(() =>
  Math.max(1, Math.round(naturalHeight.value * scale.value)),
)

const scalerStyle = computed(() => ({
  width: `${naturalWidth.value}px`,
  height: `${naturalHeight.value}px`,
  transform: `scale(${scale.value})`,
  transformOrigin: 'top left',
}))

function measureContainer() {
  const w = viewportRef.value?.clientWidth ?? 0
  if (w > 0) containerWidth.value = w
}

function onLoad() {
  loaded.value = true
  failed.value = false
  if (failTimer) {
    clearTimeout(failTimer)
    failTimer = null
  }
  void nextTick(() => {
    measureContainer()
    requestAnimationFrame(() => measureContainer())
  })
  emit('load')
}

watch(
  () => [props.reportWidth, props.reportHeight] as const,
  ([w, h]) => {
    naturalWidth.value = w
    naturalHeight.value = h
    measureContainer()
  },
)

onMounted(() => {
  measureContainer()
  requestAnimationFrame(() => measureContainer())
  window.addEventListener('message', onMessage)
  window.addEventListener('resize', measureContainer)

  if (typeof ResizeObserver !== 'undefined' && viewportRef.value) {
    resizeObserver = new ResizeObserver(() => measureContainer())
    resizeObserver.observe(viewportRef.value)
  }

  failTimer = setTimeout(() => {
    if (!loaded.value) {
      failed.value = true
      emit('fail')
    }
  }, 18_000)
})

onUnmounted(() => {
  window.removeEventListener('message', onMessage)
  window.removeEventListener('resize', measureContainer)
  resizeObserver?.disconnect()
  if (failTimer) clearTimeout(failTimer)
})

const embedSrc = lookerEmbedSrc(props.src)
</script>

<template>
  <div
    ref="viewportRef"
    class="looker-embed"
    :style="{ height: `${fitHeight}px` }"
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

    <div class="looker-embed__stage">
      <div class="looker-embed__scaler" :style="scalerStyle">
        <iframe
          ref="frameRef"
          class="looker-embed__frame"
          :title="title"
          :src="embedSrc"
          :width="naturalWidth"
          :height="naturalHeight"
          loading="lazy"
          scrolling="no"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen
          tabindex="-1"
          @load="onLoad"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.looker-embed {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--line, #e2e8f0);
}

.looker-embed__stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.looker-embed__scaler {
  transform-origin: top left;
  will-change: transform;
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
  height: 100%;
  border: 0;
  overflow: hidden !important;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.looker-embed__frame::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>
