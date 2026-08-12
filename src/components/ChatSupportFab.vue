<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { chatApi } from '@/api/services'
import { quickPromptsForRole, welcomeMessage } from '@/api/chat/prompts'
import type { ChatMessage, ChatProductRef, UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useChatWidgetStore } from '@/stores/chatWidget'
import { isChatPage, roleChatPath } from '@/utils/roleAiNav'
import { isShopBrowsePath } from '@/utils/roleNav'
import ChatPanel from '@/components/ChatPanel.vue'
import { parseDraggedProduct, refreshChatProductStock } from '@/api/chat/productCards'
import chatbotAvatar from '@/assets/chatavt.png'

const CHATBOT_AVATAR = chatbotAvatar

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const widget = useChatWidgetStore()

const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const chatError = ref('')
const lastFailedText = ref('')
const ready = ref(false)
let notifyTimer: ReturnType<typeof setInterval> | undefined
let sendSeq = 0

const shouldPollNotifications = computed(
  () => auth.isLoggedIn && auth.role === 'customer',
)

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

function prewarmChat() {
  chatApi.prewarm(effectiveRole.value, {
    userName: auth.user?.fullName,
    userId: chatUserId.value,
    sellerBackendId: auth.user?.backendId,
  })
}

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
  prewarmChat()
  await chatApi.ensureAiReady()
  messages.value = await chatApi.getHistory(chatUserId.value)
  ready.value = true
  if (shouldPollNotifications.value) {
    await pullProactiveNotifications(true)
  }
}

async function pullProactiveNotifications(silent = false) {
  if (!shouldPollNotifications.value) return
  try {
    const res = await chatApi.syncProactiveNotifications(chatUserId.value)
    widget.setUnreadBadge(res.unread)
    if (res.appended > 0) {
      messages.value = res.messages
      if (!silent && !widget.open) {
        widget.show()
      }
    } else if (res.unread === 0 && widget.unreadBadge > 0 && res.appended === 0) {
      widget.setUnreadBadge(res.unread)
    }
  } catch {
    /* ignore polling errors */
  }
}

function startNotificationPolling() {
  stopNotificationPolling()
  if (!shouldPollNotifications.value) return
  void pullProactiveNotifications(true)
  notifyTimer = setInterval(() => {
    void pullProactiveNotifications(true)
  }, 25_000)
}

function stopNotificationPolling() {
  if (notifyTimer) {
    clearInterval(notifyTimer)
    notifyTimer = undefined
  }
}

watch(
  () => widget.open,
  async (isOpen) => {
    if (isOpen) await loadHistory()
    else if (shouldPollNotifications.value) void pullProactiveNotifications(true)
  },
)

watch(
  () => [auth.isLoggedIn, auth.role, auth.user?.id] as const,
  () => {
    if (shouldPollNotifications.value) startNotificationPolling()
    else {
      stopNotificationPolling()
      widget.setUnreadBadge(0)
    }
  },
  { immediate: true },
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
  else if (showFab.value) prewarmChat()
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  stopNotificationPolling()
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && widget.open) widget.hide()
}

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
  if (loading.value) return
  const seq = ++sendSeq
  loading.value = true
  chatError.value = ''
  lastFailedText.value = ''

  const attached = widget.attachments.length ? [...widget.attachments] : undefined
  const userContent =
    text.trim() ||
    (attached?.length ? 'Cho tôi thông tin các sản phẩm đã đính kèm.' : text)

  const optimisticUser: ChatMessage = {
    id: `c-${Date.now()}`,
    role: 'user',
    content: userContent,
    timestamp: new Date().toISOString(),
    attachments: attached,
  }
  messages.value = [...messages.value, optimisticUser]
  widget.clearAttachments()

  try {
    messages.value = await chatApi.send(chatUserId.value, text, effectiveRole.value, {
      userName: auth.user?.fullName,
      sellerBackendId: auth.user?.backendId,
      attachments: attached,
      optimisticHistory: messages.value,
    })
    if (seq !== sendSeq) return
  } catch (e) {
    if (seq !== sendSeq) return
    messages.value = messages.value.filter((m) => m.id !== optimisticUser.id)
    lastFailedText.value = text
    chatError.value = e instanceof Error ? e.message : 'Không gửi được tin nhắn'
  } finally {
    if (seq === sendSeq) loading.value = false
  }
}

async function retrySend() {
  if (!lastFailedText.value || loading.value) return
  await onSend(lastFailedText.value)
}

async function onClear() {
  await chatApi.clear(chatUserId.value)
  messages.value = []
  widget.clearAttachments()
  chatError.value = ''
  lastFailedText.value = ''
}

async function onAttach(product: ChatProductRef) {
  const [fresh] = await refreshChatProductStock([product])
  widget.addAttachment(fresh ?? product)
}

function onRemoveAttachment(id: string) {
  widget.removeAttachment(id)
}

function onFabDragOver(e: DragEvent) {
  // Chrome often hides custom MIME in types until drop — always allow when dragging
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  widget.dragOver = true
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
      title="Trợ lý SmarTEcon — kéo sản phẩm vào đây để đính kèm"
      aria-label="Mở trợ lý SmarTEcon"
      @click="onFabClick"
      @mouseenter="prewarmChat"
      @focus="prewarmChat"
      @dragover="onFabDragOver"
      @dragleave="widget.dragOver = false"
      @drop="onFabDrop"
    >
      <img
        class="chat-fab__avatar"
        :src="CHATBOT_AVATAR"
        alt=""
        width="64"
        height="64"
        draggable="false"
      />
      <span v-if="widget.unreadBadge > 0" class="chat-fab__badge" aria-label="Thông báo đơn hàng mới">
        {{ widget.unreadBadge > 9 ? '9+' : widget.unreadBadge }}
      </span>
    </button>

    <div
      v-if="widget.open"
      class="chat-popup"
      role="dialog"
      aria-modal="true"
      aria-label="Trợ lý AI SEDSP"
    >
      <header class="chat-popup__head">
        <div class="chat-popup__head-main">
          <img
            class="chat-popup__avatar"
            :src="CHATBOT_AVATAR"
            alt=""
            width="40"
            height="40"
          />
          <div>
            <h2 class="chat-popup__title">{{ title }}</h2>
            <p class="chat-popup__hint-inline">
              Kéo ảnh sản phẩm vào khung chat · Esc hoặc × để đóng
            </p>
          </div>
        </div>
        <button type="button" class="chat-popup__close" aria-label="Đóng trợ lý AI" @click.stop="widget.hide()">
          ×
        </button>
      </header>
      <p v-if="chatError" class="chat-popup__error">
        {{ chatError }}
        <button
          v-if="lastFailedText"
          type="button"
          class="chat-popup__retry"
          :disabled="loading"
          @click="retrySend"
        >
          Thử lại
        </button>
      </p>
      <ChatPanel
        v-if="ready || messages.length"
        compact
        :avatar-src="CHATBOT_AVATAR"
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
  z-index: 10040;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(37, 99, 235, 0.35);
  transition:
    transform var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1));
}

.chat-fab__avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  border: 3px solid #fff;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.45);
  transition:
    box-shadow var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1)),
    transform var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1));
}

.chat-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(37, 99, 235, 0.42);
}

.chat-fab:hover .chat-fab__avatar {
  transform: scale(1.04);
}

.chat-fab--hot {
  transform: scale(1.03);
  box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.35), 0 14px 32px rgba(13, 148, 136, 0.4);
  transition:
    transform var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1));
}

.chat-fab--hot .chat-fab__avatar {
  box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.75);
}

.chat-fab__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 1.15rem;
  height: 1.15rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  background: #dc2626;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  line-height: 1.15rem;
  text-align: center;
  box-shadow: 0 0 0 2px #fff;
}

.chat-popup {
  position: fixed;
  right: 1.1rem;
  bottom: 1.1rem;
  z-index: 10050;
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

.chat-popup__head-main {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  min-width: 0;
}

.chat-popup__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.35);
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
  width: 2.15rem;
  height: 2.15rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  color: #0f172a;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.chat-popup__close:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.chat-popup__error {
  margin: 0.5rem 1rem 0;
  padding: 0.4rem 0.55rem;
  font-size: 0.75rem;
  color: #b91c1c;
  background: #fef2f2;
  border-radius: var(--radius);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chat-popup__retry {
  margin-left: auto;
  border: 1px solid #fecaca;
  background: #fff;
  color: #991b1b;
  border-radius: 6px;
  padding: 0.15rem 0.45rem;
  font-size: 0.7rem;
  cursor: pointer;
}

.chat-popup__retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  .chat-fab {
    width: 3.65rem;
    height: 3.65rem;
    right: 1rem;
    bottom: 1rem;
  }
  .chat-popup {
    right: 0.5rem;
    bottom: 0.5rem;
    width: calc(100vw - 1rem);
    height: min(78vh, 640px);
  }
}
</style>
