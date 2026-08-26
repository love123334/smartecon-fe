<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { chatApi } from '@/api/services'
import { pickQuickPrompts, welcomeMessage } from '@/api/chat/prompts'
import type { ChatLoginSession } from '@/api/chat/chatPersistence'
import type { ChatMessage, UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useChatSessionStore } from '@/stores/chatSession'
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
const chatSession = useChatSessionStore()
const router = useRouter()
const messages = ref<ChatMessage[]>([])
const savedSessions = ref<ChatLoginSession[]>([])
const showHistory = ref(false)
const loading = ref(false)
const chatError = ref('')
const lastFailedText = ref('')
const promptSeed = ref(Date.now())

const effectiveRole = computed<UserRole>(() => props.role ?? auth.role ?? 'guest')
const chatUserId = computed(() => props.storageKey ?? auth.user?.id ?? 'guest')
const quickPrompts = computed(() => pickQuickPrompts(effectiveRole.value, promptSeed.value))
const shortcuts = computed(() => roleChatShortcuts(effectiveRole.value))

function reshufflePrompts() {
  promptSeed.value = Date.now() ^ ((Math.random() * 1e9) | 0)
}

watch(effectiveRole, reshufflePrompts)

const header = computed(() => {
  if (props.pageCopy) return props.pageCopy
  const role = effectiveRole.value
  if (role === 'seller') {
    return {
      eyebrow: 'Trợ lý người bán',
      title: 'Trợ lý bán hàng',
      lead: 'Hỏi về doanh thu, tồn kho, giá cạnh tranh và gợi ý DSS.',
      placeholder: 'VD: doanh thu tháng này?',
    }
  }
  if (role === 'manager') {
    return {
      eyebrow: 'Trợ lý quản lý',
      title: 'Trợ lý quản lý',
      lead: 'Phân tích KPI, doanh thu sàn / Looker và insights vận hành.',
      placeholder: 'VD: KPI tháng này?',
    }
  }
  return {
    eyebrow: 'Trợ lý SEDSP',
    title: 'Trợ lý SEDSP',
    lead: 'Tư vấn sản phẩm, đơn hàng và giao hàng.',
    placeholder: 'VD: chính sách giao hàng?',
  }
})

onMounted(async () => {
  await chatApi.ensureAiReady()
  messages.value = await chatApi.getHistory(chatUserId.value, effectiveRole.value)
  savedSessions.value = chatApi.listSessions(chatUserId.value)
})

async function onNewChat() {
  reshufflePrompts()
  messages.value = chatApi.startNewSession(chatUserId.value, effectiveRole.value)
  savedSessions.value = chatApi.listSessions(chatUserId.value)
  showHistory.value = false
}

async function onOpenSession(sessionId: string) {
  messages.value = await chatApi.openSession(chatUserId.value, sessionId)
  savedSessions.value = chatApi.listSessions(chatUserId.value)
  showHistory.value = false
}

async function onSend(text: string) {
  if (loading.value) return
  loading.value = true
  chatError.value = ''
  lastFailedText.value = ''

  const optimisticUser: ChatMessage = {
    id: `c-${Date.now()}`,
    role: 'user',
    content: text.trim(),
    timestamp: new Date().toISOString(),
  }
  messages.value = [...messages.value, optimisticUser]

  try {
    messages.value = await chatApi.send(chatUserId.value, text, effectiveRole.value, {
      userName: auth.user?.fullName,
      sellerBackendId: auth.user?.backendId,
      optimisticHistory: messages.value,
    })
  } catch (e) {
    messages.value = messages.value.filter((m) => m.id !== optimisticUser.id)
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
  await chatApi.clear(chatUserId.value, effectiveRole.value)
  messages.value = []
  savedSessions.value = chatApi.listSessions(chatUserId.value)
  chatError.value = ''
  lastFailedText.value = ''
}

function onNavigate(path: string) {
  if (!path?.startsWith('/')) return
  void router.push(path)
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
    <div class="chat-page__session-bar">
      <span class="chat-page__session-title">{{ chatSession.sessionTitle }}</span>
      <div class="chat-page__session-actions">
        <button type="button" class="chat-page__session-btn" @click="onNewChat">Chat mới</button>
        <button
          v-if="savedSessions.length"
          type="button"
          class="chat-page__session-btn"
          @click="showHistory = !showHistory"
        >
          Lịch sử ({{ savedSessions.length }})
        </button>
      </div>
    </div>
    <div v-if="showHistory && savedSessions.length" class="chat-page__history">
      <button
        v-for="session in savedSessions"
        :key="session.id"
        type="button"
        class="chat-page__history-item"
        @click="onOpenSession(session.id)"
      >
        <span>{{ session.title }}</span>
        <small>{{ new Date(session.updatedAt).toLocaleDateString('vi-VN') }}</small>
      </button>
    </div>
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
      @navigate="onNavigate"
    />
  </div>
</template>

<style scoped>
.chat-page {
  max-width: 720px;
  margin: 0 auto;
}

.chat-page__session-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.chat-page__session-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-page__session-actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

.chat-page__session-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 0.25rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.chat-page__session-btn:hover {
  background: #eff6ff;
  border-color: #93c5fd;
}

.chat-page__history {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.chat-page__history-item {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.chat-page__history-item small {
  color: #64748b;
  flex-shrink: 0;
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
