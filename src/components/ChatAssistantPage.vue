<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { chatApi } from '@/api/services'
import { quickPromptsForRole, welcomeMessage } from '@/api/chat/prompts'
import type { ChatMessage, UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import ChatPanel from '@/components/ChatPanel.vue'

const props = defineProps<{
  role?: UserRole
  storageKey?: string
  pageCopy?: {
    eyebrow: string
    title: string
    lead: string
    placeholder: string
  }
}>()

const auth = useAuthStore()
const messages = ref<ChatMessage[]>([])
const loading = ref(false)

const effectiveRole = computed<UserRole>(() => props.role ?? auth.role ?? 'guest')
const chatUserId = computed(() => props.storageKey ?? auth.user?.id ?? 'guest')
const quickPrompts = computed(() => quickPromptsForRole(effectiveRole.value))

const header = computed(() => {
  if (props.pageCopy) return props.pageCopy
  const role = effectiveRole.value
  if (role === 'seller') {
    return {
      eyebrow: 'Seller AI',
      title: 'Trợ lý bán hàng',
      lead: 'Hỏi về doanh thu, tồn kho, giá cạnh tranh và gợi ý DSS.',
      placeholder: 'VD: doanh thu tháng này?',
    }
  }
  if (role === 'manager') {
    return {
      eyebrow: 'Manager AI',
      title: 'Trợ lý quản lý',
      lead: 'Phân tích KPI, phân khúc và kịch bản what-if.',
      placeholder: 'VD: KPI tháng này?',
    }
  }
  if (role === 'admin') {
    return {
      eyebrow: 'Admin AI',
      title: 'Trợ lý hệ thống',
      lead: 'Giám sát vận hành và hỗ trợ quản trị nền tảng.',
      placeholder: 'VD: trạng thái dịch vụ?',
    }
  }
  return {
    eyebrow: 'AI Support',
    title: 'Trợ lý SEDSP',
    lead: 'Tư vấn sản phẩm, đơn hàng, giao hàng — dữ liệu shop từ backend khi có.',
    placeholder: 'VD: chính sách giao hàng?',
  }
})

onMounted(async () => {
  messages.value = await chatApi.getHistory(chatUserId.value)
})

async function onSend(text: string) {
  loading.value = true
  try {
    messages.value = await chatApi.send(chatUserId.value, text, effectiveRole.value, {
      userName: auth.user?.fullName,
    })
  } finally {
    loading.value = false
  }
}

async function onClear() {
  await chatApi.clear(chatUserId.value)
  messages.value = []
}
</script>

<template>
  <div class="chat-page">
    <PageHeader
      class="page-header--animate"
      :eyebrow="header.eyebrow"
      :title="header.title"
      :lead="header.lead"
    />
    <ChatPanel
      :messages="messages"
      :quick-prompts="quickPrompts"
      :loading="loading"
      :placeholder="header.placeholder"
      :empty-text="welcomeMessage(effectiveRole)"
      @send="onSend"
      @clear="onClear"
    />
  </div>
</template>

<style scoped>
.chat-page {
  max-width: 720px;
  margin: 0 auto;
}
</style>
