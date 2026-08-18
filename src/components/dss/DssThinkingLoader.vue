<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    detail?: string
    cards?: number
    compact?: boolean
  }>(),
  {
    title: 'Đang tính toán',
    detail: 'Hệ thống đang đọc lịch sử bán hàng và tín hiệu vận hành.',
    cards: 0,
    compact: false,
  },
)
</script>

<template>
  <div
    class="dss-think"
    :class="{ 'dss-think--compact': compact }"
    role="status"
    aria-live="polite"
  >
    <div class="dss-think__row">
      <div class="dss-think__core" aria-hidden="true">
        <span class="dss-think__ring dss-think__ring--outer" />
        <span class="dss-think__ring dss-think__ring--inner" />
        <span class="dss-think__scan" />
        <span class="dss-think__node dss-think__node--a" />
        <span class="dss-think__node dss-think__node--b" />
        <span class="dss-think__node dss-think__node--c" />
      </div>
      <div class="dss-think__copy">
        <p class="dss-think__title">
          {{ title }}<span class="dss-think__dots" aria-hidden="true"><i /><i /><i /></span>
        </p>
        <p v-if="detail" class="dss-think__detail">{{ detail }}</p>
      </div>
    </div>

    <div v-if="cards > 0" class="dss-think__skel" aria-hidden="true">
      <article v-for="n in cards" :key="n" class="dss-think__card">
        <span class="dss-think__bar dss-think__bar--sm" />
        <span class="dss-think__bar dss-think__bar--lg" />
        <span class="dss-think__bar" />
        <span class="dss-think__bar dss-think__bar--block" />
      </article>
    </div>
  </div>
</template>

<style scoped>
.dss-think {
  margin: 0 0 1.35rem;
  padding: 1.1rem 1.15rem 1.2rem;
  border: 1px solid #dbeafe;
  border-radius: 14px;
  background: linear-gradient(180deg, #f4f9ff 0%, #fff 72%);
}

.dss-think--compact {
  margin: 0.85rem 0 0;
  padding: 0.85rem 1rem;
}

.dss-think__row {
  display: flex;
  align-items: center;
  gap: 0.95rem;
}

.dss-think__core {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
}

.dss-think--compact .dss-think__core {
  width: 40px;
  height: 40px;
}

.dss-think__ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
}

.dss-think__ring--outer {
  border-top-color: #1565c0;
  border-right-color: #90caf9;
  animation: dss-spin 1.4s linear infinite;
}

.dss-think__ring--inner {
  inset: 8px;
  border-bottom-color: #0d47a1;
  border-left-color: #bbdefb;
  animation: dss-spin-rev 2s linear infinite;
}

.dss-think__scan {
  position: absolute;
  left: 12px;
  right: 12px;
  top: 12px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #42a5f5, transparent);
  animation: dss-scan 1.15s ease-in-out infinite;
}

.dss-think__node {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #1565c0;
  box-shadow: 0 0 0 4px rgba(21, 101, 192, 0.12);
  animation: dss-node 1.2s ease-in-out infinite;
}

.dss-think__node--a { top: 6px; left: 22px; }
.dss-think__node--b { bottom: 10px; left: 10px; animation-delay: 0.2s; }
.dss-think__node--c { bottom: 10px; right: 10px; animation-delay: 0.4s; }

.dss-think__copy { min-width: 0; }

.dss-think__title {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 750;
  color: #0d47a1;
}

.dss-think__dots {
  display: inline-flex;
  gap: 0.18rem;
  margin-left: 0.2rem;
  vertical-align: 0.12em;
}

.dss-think__dots i {
  width: 0.28rem;
  height: 0.28rem;
  border-radius: 50%;
  background: #1565c0;
  animation: dss-dot 1s ease-in-out infinite;
}

.dss-think__dots i:nth-child(2) { animation-delay: 0.16s; }
.dss-think__dots i:nth-child(3) { animation-delay: 0.32s; }

.dss-think__detail {
  margin: 0.28rem 0 0;
  color: #334155;
  font-size: 0.88rem;
  line-height: 1.5;
  font-weight: 500;
}

.dss-think__skel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  margin-top: 1rem;
}

.dss-think__card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-height: 132px;
  padding: 0.95rem 1rem;
  border-radius: 12px;
  border: 1px solid #e8eef8;
  background: #fff;
}

.dss-think__bar {
  display: block;
  height: 10px;
  width: 78%;
  border-radius: 999px;
  background: linear-gradient(90deg, #e8eef8 25%, #f8fbff 50%, #e8eef8 75%);
  background-size: 200% 100%;
  animation: dss-shimmer 1.25s ease-in-out infinite;
}

.dss-think__bar--sm { width: 38%; height: 8px; }
.dss-think__bar--lg { width: 62%; height: 14px; }
.dss-think__bar--block {
  width: 100%;
  height: 42px;
  border-radius: 8px;
  margin-top: auto;
}

@keyframes dss-spin {
  to { transform: rotate(360deg); }
}

@keyframes dss-spin-rev {
  to { transform: rotate(-360deg); }
}

@keyframes dss-scan {
  0%, 100% { transform: translateY(0); opacity: 0.35; }
  50% { transform: translateY(26px); opacity: 1; }
}

@keyframes dss-node {
  0%, 100% { transform: scale(0.85); opacity: 0.55; }
  50% { transform: scale(1.15); opacity: 1; }
}

@keyframes dss-dot {
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-3px); }
}

@keyframes dss-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 900px) {
  .dss-think__skel { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .dss-think__ring,
  .dss-think__scan,
  .dss-think__node,
  .dss-think__bar,
  .dss-think__dots i {
    animation: none;
  }
}
</style>
