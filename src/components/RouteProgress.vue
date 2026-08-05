<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const active = ref(false)
const width = ref(0)
let tick: ReturnType<typeof setInterval> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearTimers() {
  if (tick) {
    clearInterval(tick)
    tick = null
  }
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function start() {
  clearTimers()
  active.value = true
  width.value = 12
  tick = setInterval(() => {
    if (width.value >= 88) return
    width.value += Math.max(1.5, (90 - width.value) * 0.08)
  }, 120)
}

function finish() {
  clearTimers()
  width.value = 100
  hideTimer = setTimeout(() => {
    active.value = false
    width.value = 0
  }, 220)
}

onMounted(() => {
  router.beforeEach((_to, _from, next) => {
    start()
    next()
  })
  router.afterEach(() => finish())
  router.onError(() => finish())
})

onBeforeUnmount(() => clearTimers())
</script>

<template>
  <div
    class="route-progress"
    :class="{ 'route-progress--on': active }"
    aria-hidden="true"
  >
    <div class="route-progress__bar" :style="{ width: `${width}%` }" />
  </div>
</template>

<style scoped>
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 9999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.route-progress--on {
  opacity: 1;
}

.route-progress__bar {
  height: 100%;
  background: linear-gradient(90deg, var(--blue, #2e7df6), #60a5fa);
  box-shadow: 0 0 8px rgba(46, 125, 246, 0.45);
  transition: width 0.18s ease-out;
}
</style>
