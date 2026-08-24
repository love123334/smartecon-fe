<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const active = ref(false)
const progress = ref(0)
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
  progress.value = 0.15
  tick = setInterval(() => {
    if (progress.value >= 0.88) return
    progress.value += Math.max(0.02, (0.92 - progress.value) * 0.12)
  }, 100)
}

function finish() {
  clearTimers()
  progress.value = 1
  hideTimer = setTimeout(() => {
    active.value = false
    progress.value = 0
  }, 240)
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
    <div
      class="route-progress__bar"
      :style="{ transform: `scaleX(${progress})` }"
    />
    <div class="route-progress__sparkle" :style="{ left: `${progress * 100}%` }" />
  </div>
</template>

<style scoped>
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s cubic-bezier(0.23, 1, 0.32, 1);
}

.route-progress--on {
  opacity: 1;
}

.route-progress__bar {
  height: 100%;
  width: 100%;
  transform-origin: left center;
  background: linear-gradient(
    90deg,
    #2563eb 0%,
    #3b82f6 30%,
    #38bdf8 70%,
    #818cf8 100%
  );
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.75), 0 0 4px rgba(37, 99, 235, 0.5);
  transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1);
  will-change: transform;
}

.route-progress__sparkle {
  position: absolute;
  top: 0;
  width: 24px;
  height: 3px;
  margin-left: -24px;
  background: radial-gradient(circle, #ffffff 0%, rgba(56, 189, 248, 0.8) 50%, transparent 100%);
  filter: drop-shadow(0 0 6px #38bdf8);
  opacity: 0.9;
  transition: left 0.2s cubic-bezier(0.23, 1, 0.32, 1);
}
</style>
