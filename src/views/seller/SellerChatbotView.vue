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
    messages.value = await chatApi.getHistory(`seller-${auth.user.id}`)
  }
})

async function onSend(text: string): Promise<void> {
  if (!auth.user) return
  messages.value = await chatApi.send(`seller-${auth.user.id}`, text, 'seller')
}
</script>

<template>
  <div>
    <PageHeader
      class="page-header--animate"
      eyebrow="Seller AI"
      title="Trợ lý bán hàng"
      lead="Hỏi về doanh thu, tồn kho, giá cạnh tranh và gợi ý DSS."
    />
    <ChatPanel
      :messages="messages"
      placeholder="VD: doanh thu tháng này?"
      empty-text="Hỏi về KPI, tồn kho hoặc chiến lược giá."
      @send="onSend"
    />
  </div>
</template>
