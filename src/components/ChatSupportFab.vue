<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { chatApi } from '@/api/services'
import { quickPromptsForRole, welcomeMessage } from '@/api/chat/prompts'
import type { ChatMessage, ChatProductRef, UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useChatWidgetStore } from '@/stores/chatWidget'
import { isChatPage, roleChatPath } from '@/utils/roleAiNav'
import { isShopBrowsePath } from '@/utils/roleNav'
import ChatPanel from '@/components/ChatPanel.vue'
import { parseDraggedProduct, refreshChatProductStock, SEDSP_PRODUCT_DRAG_MIME } from '@/api/chat/productCards'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const widget = useChatWidgetStore()

const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const chatError = ref('')
const ready = ref(false)

const effectiveRole = computed<UserRole>(() => {
  if (auth.role === 'seller') return 'seller'
  if (auth.role === 'manager') return 'manager'
  if (auth.role === 'customer') return 'customer'
  return auth.isLoggedIn ? (auth.role ?? 'customer') : 'guest'
})

const chatUserId = computed(() => {
  if (!auth.user) return 'guest'
  if (auth.role === 'seller') return `seller-${auth.user.id}`
  return auth.user.id
})

const quickPrompts = computed(() => quickPromptsForRole(effectiveRole.value))

const title = computed(() => {
  if (effectiveRole.value === 'seller') return 'Trợ lý bán hàng'
  if (effectiveRole.value === 'manager') return 'Trợ lý quản lý'
  return 'Trợ lý SEDSP'
})

const placeholder = computed(() => {
  if (effectiveRole.value === 'seller') return 'VD: doanh thu tháng này?'
  if (effectiveRole.value === 'manager') return 'VD: KPI tháng này?'
  return 'VD: tai nghe dưới 2 triệu'
})

const showFab = computed(() => {
  if (['/login', '/register'].includes(route.path)) return false
  if (auth.role === 'admin') return false

  if (!auth.isLoggedIn) {
    return ['/', '/search', '/products'].some(
      (p) => route.path === p || route.path.startsWith(`${p}/`),
    )
  }

  if (auth.role === 'customer' || auth.role === 'guest') {
    return isShopBrowsePath(route.path) || isChatPage(route.path)
  }

  return true
})

async function loadHistory() {
  await chatApi.ensureAiReady()
  messages.value = await chatApi.getHistory(chatUserId.value)
  ready.value = true
}

watch(
  () => widget.open,
  async (isOpen) => {
    if (isOpen) await loadHistory()
  },
)

watch(
  () => route.path,
  (path) => {
    if (isChatPage(path)) widget.show()
  },
  { immediate: true },
)

onMounted(() => {
  if (widget.open) void loadHistory()
})

function onFabClick() {
  if (!auth.isLoggedIn && !showFab.value) {
    void router.push({ path: '/login', query: { redirect: roleChatPath('customer') } })
    return
  }
  if (!auth.isLoggedIn) {
    // guest vẫn chat được trên shop
    widget.toggle()
    return
  }
  widget.toggle()
}

async function onSend(text: string) {
  loading.value = true
  chatError.value = ''
  try {
    const attached = widget.attachments.length
      ? await refreshChatProductStock([...widget.attachments])
      : []
    if (attached.length) {
      widget.setAttachments(attached)
    }
    messages.value = await chatApi.send(chatUserId.value, text, effectiveRole.value, {
      userName: auth.user?.fullName,
      sellerBackendId: auth.user?.backendId,
      attachments: attached.length ? attached : undefined,
    })
    widget.clearAttachments()
  } catch (e) {
    chatError.value = e instanceof Error ? e.message : 'Không gửi được tin nhắn'
  } finally {
    loading.value = false
  }
}

async function onClear() {
  await chatApi.clear(chatUserId.value)
  messages.value = []
  widget.clearAttachments()
}

async function onAttach(product: ChatProductRef) {
  const [fresh] = await refreshChatProductStock([product])
  widget.addAttachment(fresh ?? product)
}

function onRemoveAttachment(id: string) {
  widget.removeAttachment(id)
}

function onFabDragOver(e: DragEvent) {
  if (!e.dataTransfer) return
  const types = [...e.dataTransfer.types]
  if (
    types.includes(SEDSP_PRODUCT_DRAG_MIME) ||
    types.includes('application/json') ||
    types.includes('text/plain')
  ) {
    e.preventDefault()
    widget.dragOver = true
  }
}

function onFabDrop(e: DragEvent) {
  e.preventDefault()
  widget.dragOver = false
  const product = parseDraggedProduct(e.dataTransfer)
  if (product) {
    void onAttach(product)
    widget.show()
  }
}
</script>

<template>
  <Teleport to="body">
    <button
      v-if="showFab && !widget.open"
      type="button"
      class="chat-fab btn-interactive"
      :class="{ 'chat-fab--hot': widget.dragOver }"
      title="Trợ lý AI — kéo sản phẩm vào đây để đính kèm"
      aria-label="Mở trợ lý AI"
      @click="onFabClick"
      @dragover="onFabDragOver"
      @dragleave="widget.dragOver = false"
      @drop="onFabDrop"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span class="chat-fab__label">AI</span>
    </button>

    <div
      v-if="widget.open"
      class="chat-popup"
      role="dialog"
      aria-modal="true"
      aria-label="Trợ lý AI SEDSP"
    >
      <header class="chat-popup__head">
        <div>
          <h2 class="chat-popup__title">{{ title }}</h2>
          <p class="chat-popup__hint-inline">
            Kéo sản phẩm từ cửa hàng vào khung chat để hỏi / so sánh
          </p>
        </div>
        <button type="button" class="chat-popup__close" aria-label="Đóng" @click="widget.hide()">
          ×
        </button>
      </header>
      <p v-if="chatError" class="chat-popup__error">{{ chatError }}</p>
      <ChatPanel
        v-if="ready || messages.length"
        compact
        :messages="messages"
        :quick-prompts="quickPrompts"
        :loading="loading"
        :placeholder="placeholder"
        :empty-text="welcomeMessage(effectiveRole)"
        :attachments="widget.attachments"
        @send="onSend"
        @clear="onClear"
        @attach-product="onAttach"
        @remove-attachment="onRemoveAttachment"
      />
      <p v-else class="chat-popup__loading">Đang tải trợ lý…</p>
    </div>
  </Teleport>
</template>

<style scoped>
.chat-fab {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 120;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 999px;
  background: #000;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  transition: transform var(--transition), box-shadow var(--transition), background var(--transition);
}

.chat-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
}

.chat-fab--hot {
  background: var(--primary-600, #0d9488);
  transform: scale(1.06);
}

.chat-fab__label {
  letter-spacing: 0.04em;
}

.chat-popup {
  position: fixed;
  right: 1.1rem;
  bottom: 1.1rem;
  z-index: 130;
  display: flex;
  flex-direction: column;
  width: min(420px, calc(100vw - 1.5rem));
  height: min(620px, calc(100vh - 2rem));
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.2);
  overflow: hidden;
}

.chat-popup__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.95rem 1rem 0.55rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
}

.chat-popup__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.chat-popup__hint-inline {
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
  line-height: 1.35;
  color: var(--slate-500);
}

.chat-popup__close {
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 8px;
  background: var(--slate-100);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  color: var(--slate-700);
  flex-shrink: 0;
}

.chat-popup__error {
  margin: 0.5rem 1rem 0;
  padding: 0.4rem 0.55rem;
  font-size: 0.75rem;
  color: #b91c1c;
  background: #fef2f2;
  border-radius: var(--radius);
  flex-shrink: 0;
}

.chat-popup__loading {
  margin: auto;
  padding: 2rem;
  color: var(--slate-500);
  font-size: 0.875rem;
}

.chat-popup :deep(.chat-panel) {
  border: none;
  border-radius: 0;
  padding-top: 0.55rem;
  min-height: 0;
  flex: 1;
}

.chat-popup :deep(.chat-messages) {
  background: #f8fafc;
}

.chat-popup :deep(.chat-bubble__products) {
  grid-template-columns: minmax(0, 1fr);
  max-width: 100%;
  overflow: hidden;
}

@media (min-width: 420px) {
  .chat-popup :deep(.chat-bubble__products) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .chat-fab__label {
    display: none;
  }
  .chat-fab {
    padding: 0.85rem;
    border-radius: 50%;
  }
  .chat-popup {
    right: 0.5rem;
    bottom: 0.5rem;
    width: calc(100vw - 1rem);
    height: min(78vh, 640px);
  }
}
</style>
