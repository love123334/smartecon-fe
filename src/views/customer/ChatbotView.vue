<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { chatApi } from '@/api/services'
import type { ChatMessage } from '@/types'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import ChatPanel from '@/components/ChatPanel.vue'

const auth = useAuthStore()
const messages = ref<ChatMessage[]>([])

onMounted(async () => {
  if (auth.user) {
    messages.value = await chatApi.getHistory(auth.user.id)
  }
})

async function onSend(text: string): Promise<void> {
  if (!auth.user) return
  messages.value = await chatApi.send(auth.user.id, text, auth.role)
}
</script>

<template>
  <div>
    <PageHeader
      class="page-header--animate"
      eyebrow="AI"
      title="Trợ lý mua sắm"
      lead="Tư vấn sản phẩm, giao hàng và thanh toán — phản hồi mô phỏng."
    />
    <ChatPanel
      :messages="messages"
      placeholder="VD: chính sách giao hàng?"
      empty-text="Xin chào! Tôi có thể giúp gì cho bạn?"
      @send="onSend"
    />
  </div>
</template>
