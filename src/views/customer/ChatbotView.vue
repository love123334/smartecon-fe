<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatWidgetStore } from '@/stores/chatWidget'
import { useAuthStore } from '@/stores/auth'
import { roleHomePath } from '@/utils/roleNav'

const widget = useChatWidgetStore()
const router = useRouter()
const auth = useAuthStore()

onMounted(() => {
  widget.show()
  void router.replace(roleHomePath(auth.role) || '/')
})
</script>

<template>
  <div class="chat-redirect" aria-live="polite">Đang mở trợ lý AI…</div>
</template>

<style scoped>
.chat-redirect {
  padding: 2rem;
  text-align: center;
  color: var(--slate-500);
  font-size: 0.9rem;
}
</style>
