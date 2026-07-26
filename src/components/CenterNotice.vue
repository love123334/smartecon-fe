<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useNoticeStore } from '@/stores/notice'

const notice = useNoticeStore()
const { open, title, message, kind } = storeToRefs(notice)
</script>

<template>
  <Teleport to="body">
    <Transition name="center-notice">
      <div
        v-if="open"
        class="center-notice"
        role="alertdialog"
        aria-modal="true"
        :aria-label="title || message"
        @click.self="notice.dismiss()"
      >
        <div class="center-notice__box" :class="`center-notice__box--${kind}`">
          <p v-if="title" class="center-notice__title">{{ title }}</p>
          <p class="center-notice__msg">{{ message }}</p>
          <button type="button" class="center-notice__ok" @click="notice.dismiss()">
            Đóng
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.center-notice {
  position: fixed;
  inset: 0;
  z-index: 12000;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
}

.center-notice__box {
  width: min(320px, 100%);
  padding: 1.25rem 1.35rem 1.1rem;
  border-radius: 14px;
  background: #fff;
  text-align: center;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.22);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.center-notice__box--stock {
  border-color: rgba(185, 28, 28, 0.18);
}

.center-notice__title {
  margin: 0 0 0.35rem;
  font-family: var(--font-display, Georgia, serif);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #0f172a;
}

.center-notice__box--stock .center-notice__title {
  color: #b91c1c;
}

.center-notice__msg {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.45;
  color: #475569;
}

.center-notice__ok {
  margin-top: 0.95rem;
  min-width: 6.5rem;
  padding: 0.45rem 1rem;
  border: none;
  border-radius: 8px;
  background: #0f172a;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.center-notice__box--stock .center-notice__ok {
  background: #b91c1c;
}

.center-notice__ok:hover {
  filter: brightness(1.08);
}

.center-notice-enter-active,
.center-notice-leave-active {
  transition: opacity 0.18s ease;
}
.center-notice-enter-active .center-notice__box,
.center-notice-leave-active .center-notice__box {
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.center-notice-enter-from,
.center-notice-leave-to {
  opacity: 0;
}
.center-notice-enter-from .center-notice__box,
.center-notice-leave-to .center-notice__box {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}
</style>
