<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { chatApi } from '@/api/services'
import type { ChatMessage } from '@/types'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import ChatPanel from '@/components/ChatPanel.vue'

const auth = useAuthStore()
const messages = ref<ChatMessage[]>([])

const pageCopy = computed(() => {
  const role = auth.role
  if (role === 'manager') {
    return {
      eyebrow: 'Manager AI',
      title: 'Trợ lý quản lý',
      lead: 'Phân tích doanh thu, phân khúc khách hàng và kịch bản what-if.',
      placeholder: 'VD: doanh thu theo danh mục?',
      empty: 'Hỏi về KPI, xu hướng hoặc mô phỏng chiến lược.',
    }
  }
  if (role === 'admin') {
    return {
      eyebrow: 'Admin AI',
      title: 'Trợ lý hệ thống',
      lead: 'Theo dõi sức khỏe hệ thống và hỗ trợ vận hành nền tảng.',
      placeholder: 'VD: trạng thái dịch vụ?',
      empty: 'Hỏi về giám sát, người dùng hoặc vận hành hệ thống.',
    }
  }
  return {
    eyebrow: 'AI',
    title: 'Trợ lý mua sắm',
    lead: 'Tư vấn sản phẩm, giao hàng và thanh toán — phản hồi mô phỏng.',
    placeholder: 'VD: chính sách giao hàng?',
    empty: 'Xin chào! Tôi có thể giúp gì cho bạn?',
  }
})

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
      :eyebrow="pageCopy.eyebrow"
      :title="pageCopy.title"
      :lead="pageCopy.lead"
    />
    <ChatPanel
      :messages="messages"
      :placeholder="pageCopy.placeholder"
      :empty-text="pageCopy.empty"
      @send="onSend"
    />
  </div>
</template>
