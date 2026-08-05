<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { chatApi } from '@/api/services'
import { quickPromptsForRole, welcomeMessage } from '@/api/chat/prompts'
import type { ChatMessage, UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import AiShortcutBar from '@/components/AiShortcutBar.vue'
import { roleChatShortcuts } from '@/utils/roleAiNav'

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
const chatError = ref('')
const lastFailedText = ref('')

const effectiveRole = computed<UserRole>(() => props.role ?? auth.role ?? 'guest')
const chatUserId = computed(() => props.storageKey ?? auth.user?.id ?? 'guest')
const quickPrompts = computed(() => quickPromptsForRole(effectiveRole.value))
const shortcuts = computed(() => roleChatShortcuts(effectiveRole.value))

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
      lead: 'Phân tích KPI, doanh thu sàn / Looker và insights vận hành.',
      placeholder: 'VD: KPI tháng này?',
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
  await chatApi.ensureAiReady()
  messages.value = await chatApi.getHistory(chatUserId.value)
})

async function onSend(text: string) {
  loading.value = true
  chatError.value = ''
  lastFailedText.value = ''
  try {
    messages.value = await chatApi.send(chatUserId.value, text, effectiveRole.value, {
      userName: auth.user?.fullName,
      sellerBackendId: auth.user?.backendId,
    })
  } catch (e) {
    lastFailedText.value = text
    chatError.value = e instanceof Error ? e.message : 'Không gửi được tin nhắn'
  } finally {
    loading.value = false
  }
}

async function retrySend() {
  if (!lastFailedText.value || loading.value) return
  await onSend(lastFailedText.value)
}

async function onClear() {
  await chatApi.clear(chatUserId.value)
  messages.value = []
  chatError.value = ''
  lastFailedText.value = ''
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
    <AiShortcutBar title="Module liên quan:" :links="shortcuts" />
    <p v-if="chatError" class="chat-error">
      {{ chatError }}
      <button
        v-if="lastFailedText"
        type="button"
        class="chat-error__retry"
        :disabled="loading"
        @click="retrySend"
      >
        Thử lại
      </button>
    </p>
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

.chat-error {
  margin: 0 0 0.75rem;
  padding: 0.5rem 0.65rem;
  font-size: 0.8125rem;
  color: #b91c1c;
  background: #fef2f2;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.chat-error__retry {
  margin-left: auto;
  border: 1px solid #fecaca;
  background: #fff;
  color: #991b1b;
  border-radius: 6px;
  padding: 0.2rem 0.55rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.chat-error__retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
