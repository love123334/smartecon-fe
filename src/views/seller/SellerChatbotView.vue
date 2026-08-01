<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatWidgetStore } from '@/stores/chatWidget'

const widget = useChatWidgetStore()
const router = useRouter()

onMounted(() => {
  widget.show()
  void router.replace('/seller/products')
})
</script>

<template>
  <div class="chat-redirect" aria-live="polite">Đang mở trợ lý bán hàng…</div>
</template>

<style scoped>
.chat-redirect {
  padding: 2rem;
  text-align: center;
  color: var(--slate-500);
  font-size: 0.9rem;
}
</style>
