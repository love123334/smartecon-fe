<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { chatApi } from '@/api/services'
import { pickQuickPrompts, welcomeMessage } from '@/api/chat/prompts'
import type { ChatMessage, ChatProductRef, UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useChatSessionStore } from '@/stores/chatSession'
import { useChatWidgetStore } from '@/stores/chatWidget'
import type { ChatLoginSession } from '@/api/chat/chatPersistence'
import { isChatPage } from '@/utils/roleAiNav'
import { isShopBrowsePath } from '@/utils/roleNav'
import ChatPanel from '@/components/ChatPanel.vue'
import HammerSickleLoader from '@/components/HammerSickleLoader.vue'
import { parseDraggedProduct, refreshChatProductStock } from '@/api/chat/productCards'
import ChatBotIcon from '@/components/icons/ChatBotIcon.vue'

const auth = useAuthStore()
const chatSession = useChatSessionStore()
const route = useRoute()
const router = useRouter()
const widget = useChatWidgetStore()

const messages = ref<ChatMessage[]>([])
const savedSessions = ref<ChatLoginSession[]>([])
const showHistory = ref(false)
const loading = ref(false)
const chatError = ref('')
const lastFailedText = ref('')
const ready = ref(false)
const promptSeed = ref(Date.now())
let notifyTimer: ReturnType<typeof setInterval> | undefined
let sendSeq = 0

const shouldPollNotifications = computed(
  () => auth.isLoggedIn && (auth.role === 'customer' || auth.role === 'seller'),
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

function reshufflePrompts() {
  promptSeed.value = Date.now() ^ ((Math.random() * 1e9) | 0)
}

function prewarmChat() {
  chatApi.prewarm(effectiveRole.value, {
    userName: auth.user?.fullName,
    userId: chatUserId.value,
    sellerBackendId: auth.user?.backendId,
  })
}

const quickPrompts = computed(() => pickQuickPrompts(effectiveRole.value, promptSeed.value))

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
  messages.value = await chatApi.getHistory(chatUserId.value, effectiveRole.value)
  savedSessions.value = chatApi.listSessions(chatUserId.value)
  ready.value = true
  if (shouldPollNotifications.value) {
    await pullProactiveNotifications(true)
  }
}

async function onNewChat() {
  reshufflePrompts()
  messages.value = chatApi.startNewSession(chatUserId.value, effectiveRole.value)
  savedSessions.value = chatApi.listSessions(chatUserId.value)
  widget.clearAttachments()
  chatError.value = ''
  lastFailedText.value = ''
  showHistory.value = false
}

async function onOpenSession(sessionId: string) {
  if (loading.value) return
  messages.value = await chatApi.openSession(chatUserId.value, sessionId)
  savedSessions.value = chatApi.listSessions(chatUserId.value)
  showHistory.value = false
}

async function pullProactiveNotifications(silent = false) {
  if (!shouldPollNotifications.value) return
  try {
    const res = await chatApi.syncProactiveNotifications(
      chatUserId.value,
      effectiveRole.value,
      widget.open,
    )
    if (!widget.open) {
      const badgeCount = Math.max(res.unread, widget.unreadBadge + res.appended)
      if (badgeCount > 0) {
        widget.setUnreadBadge(badgeCount)
      }
    } else {
      widget.setUnreadBadge(0)
    }
    if (res.appended > 0) {
      messages.value = res.messages
      if (!silent && !widget.open) {
        widget.show()
      }
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
  }, 5_000)
}

function stopNotificationPolling() {
  if (notifyTimer) {
    clearInterval(notifyTimer)
    notifyTimer = undefined
  }
}

function onFabClick() {
  widget.setUnreadBadge(0)
  void chatApi.markAllNotificationsRead()
  widget.toggle()
}

watch(
  () => widget.open,
  async (isOpen) => {
    if (isOpen) {
      widget.setUnreadBadge(0)
      void chatApi.markAllNotificationsRead()
      reshufflePrompts()
      await loadHistory()
    } else if (shouldPollNotifications.value) {
      void pullProactiveNotifications(true)
    }
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
  if (e.key !== 'Escape') return
  if (showHistory.value) {
    showHistory.value = false
    return
  }
  if (widget.open) widget.hide()
}

function toggleHistory() {
  showHistory.value = !showHistory.value
}

function closeHistory() {
  showHistory.value = false
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
    savedSessions.value = chatApi.listSessions(chatUserId.value)
    if (seq !== sendSeq) return
  } catch (e) {
    if (seq !== sendSeq) return
    messages.value = messages.value.filter((m) => m.id !== optimisticUser.id)
    lastFailedText.value = text
    chatError.value =
      e instanceof Error && e.message
        ? e.message
        : 'Không gửi được tin nhắn. Kiểm tra mạng hoặc thử lại sau vài giây.'
  } finally {
    if (seq === sendSeq) loading.value = false
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

function onNavigate(path: string) {
  if (!path?.startsWith('/')) return
  widget.hide()
  void router.push(path)
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
      <span class="chat-fab__icon" aria-hidden="true">
        <ChatBotIcon :size="34" />
      </span>
      <span v-if="widget.unreadBadge > 0" class="chat-fab__badge" aria-label="Thông báo đơn hàng mới">
        {{ widget.unreadBadge > 9 ? '9+' : widget.unreadBadge }}
      </span>
    </button>

    <Transition name="chat-popup">
    <div
      v-if="widget.open"
      class="chat-popup"
      :class="{ 'chat-popup--drawer-open': showHistory }"
      role="dialog"
      aria-modal="true"
      aria-label="Trợ lý AI SEDSP"
    >
      <button
        v-if="showHistory"
        type="button"
        class="chat-popup__drawer-backdrop"
        aria-label="Đóng lịch sử"
        @click="closeHistory"
      />

      <aside
        class="chat-popup__drawer"
        :class="{ 'chat-popup__drawer--open': showHistory }"
        aria-label="Lịch sử chat"
        :aria-hidden="!showHistory"
      >
        <div class="chat-popup__drawer-head">
          <h3 class="chat-popup__drawer-title">Lịch sử</h3>
          <button
            type="button"
            class="chat-popup__drawer-close"
            aria-label="Đóng lịch sử"
            @click="closeHistory"
          >
            ×
          </button>
        </div>
        <button type="button" class="chat-popup__drawer-new" @click="onNewChat">
          <span class="chat-popup__drawer-new-icon" aria-hidden="true">+</span>
          Cuộc chat mới
        </button>
        <div class="chat-popup__drawer-list">
          <button
            type="button"
            class="chat-popup__history-item chat-popup__history-item--current"
            @click="closeHistory"
          >
            <span class="chat-popup__history-title">{{ chatSession.sessionTitle }}</span>
            <span class="chat-popup__history-meta">Đang chat</span>
          </button>
          <template v-if="savedSessions.length">
            <p class="chat-popup__drawer-divider">Trước đó</p>
            <button
              v-for="session in savedSessions"
              :key="session.id"
              type="button"
              class="chat-popup__history-item"
              :class="{
                'chat-popup__history-item--active': chatSession.activeSessionId === session.id,
              }"
              @click="onOpenSession(session.id)"
            >
              <span class="chat-popup__history-title">{{ session.title }}</span>
              <span class="chat-popup__history-meta">
                {{ new Date(session.updatedAt).toLocaleDateString('vi-VN') }}
              </span>
            </button>
          </template>
          <p v-else class="chat-popup__drawer-empty">Chưa có cuộc chat đã lưu.</p>
        </div>
      </aside>

      <div class="chat-popup__main">
        <header class="chat-popup__head">
          <button
            type="button"
            class="chat-popup__menu"
            :class="{ 'chat-popup__menu--active': showHistory }"
            aria-label="Mở lịch sử chat"
            :aria-expanded="showHistory"
            @click="toggleHistory"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <div class="chat-popup__head-main">
            <span class="chat-popup__avatar" aria-hidden="true">
              <ChatBotIcon :size="28" />
            </span>
            <div class="chat-popup__head-text">
              <div class="chat-popup__head-title-row">
                <h2 class="chat-popup__title">{{ title }}</h2>
                <span class="chat-status-badge">🟢 AI</span>
              </div>
              <p class="chat-popup__session-title" :title="chatSession.sessionTitle">
                {{ chatSession.sessionTitle }}
              </p>
            </div>
          </div>
          <div class="chat-popup__head-actions">
            <button
              type="button"
              class="chat-popup__icon-btn"
              title="Cuộc chat mới"
              aria-label="Cuộc chat mới"
              @click="onNewChat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              class="chat-popup__close"
              aria-label="Đóng trợ lý AI"
              @click.stop="widget.hide()"
            >
              ×
            </button>
          </div>
        </header>
        <p class="chat-popup__hint-inline">
          Kéo ảnh sản phẩm vào khung chat · Esc để đóng
        </p>
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
          @navigate="onNavigate"
        />
        <HammerSickleLoader
          v-else
          class="chat-popup__loading"
          size="sm"
          label="Đang tải trợ lý"
          :show-bang="false"
        />
      </div>
    </div>
    </Transition>
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

.chat-fab__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(145deg, #2563eb 0%, #1d4ed8 100%);
  border: 3px solid #fff;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.45);
  transition:
    box-shadow var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1)),
    transform var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1));
}

@media (hover: hover) and (pointer: fine) {
  .chat-fab:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 32px rgba(37, 99, 235, 0.42);
  }
}

.chat-fab:active {
  transform: scale(0.98);
  opacity: 0.94;
  transition-duration: var(--dur-press);
}

.chat-fab--hot {
  transform: scale(1.03);
  box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.35), 0 14px 32px rgba(13, 148, 136, 0.4);
  transition:
    transform var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--transition-slow, 0.48s cubic-bezier(0.22, 1, 0.36, 1));
}

.chat-fab--hot .chat-fab__icon {
  box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.75);
}

.chat-fab__badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.35rem;
  text-align: center;
  border: 2px solid #ffffff;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.8), 0 2px 6px rgba(0, 0, 0, 0.2);
  animation: badge-pulse 2s infinite ease-in-out;
}

@keyframes badge-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.8), 0 2px 6px rgba(0, 0, 0, 0.2);
  }
  50% {
    transform: scale(1.12);
    box-shadow: 0 0 16px rgba(239, 68, 68, 1), 0 2px 8px rgba(0, 0, 0, 0.3);
  }
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
  font-family: var(--font-body);
  color: var(--color-text);
  line-height: 1.68;
  -webkit-font-smoothing: antialiased;
  transform-origin: bottom right;
}

.chat-popup-enter-active {
  transition:
    opacity var(--dur-panel) var(--ease-drawer),
    transform var(--dur-panel) var(--ease-drawer);
}

.chat-popup-leave-active {
  transition:
    opacity 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}

.chat-popup-enter-from,
.chat-popup-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

.chat-popup__main {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.chat-popup__drawer-backdrop {
  position: absolute;
  inset: 0;
  z-index: 12;
  border: none;
  padding: 0;
  margin: 0;
  background: rgba(15, 23, 42, 0.38);
  cursor: pointer;
  animation: chat-drawer-fade var(--dur-ui) var(--ease-out);
}

.chat-popup__drawer {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 13;
  display: flex;
  flex-direction: column;
  width: min(272px, 88%);
  background: #fff;
  border-right: 1px solid #e2e8f0;
  box-shadow: 8px 0 24px rgba(15, 23, 42, 0.12);
  transform: translateX(-100%);
  transform-origin: left center;
  transition: transform var(--dur-panel) var(--ease-drawer);
  pointer-events: none;
}

.chat-popup__drawer--open {
  transform: translateX(0);
  pointer-events: auto;
}

.chat-popup__drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.85rem 0.85rem 0.55rem;
  flex-shrink: 0;
}

.chat-popup__drawer-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
}

.chat-popup__drawer-close {
  width: 1.85rem;
  height: 1.85rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.chat-popup__drawer-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.chat-popup__drawer-new {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0.75rem 0.65rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  flex-shrink: 0;
}

.chat-popup__drawer-new:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.chat-popup__drawer-new-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #cbd5e1;
  font-size: 0.9rem;
  line-height: 1;
}

.chat-popup__drawer-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0.45rem 0.75rem;
}

.chat-popup__drawer-divider {
  margin: 0.35rem 0.45rem 0.4rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #94a3b8;
}

.chat-popup__drawer-empty {
  margin: 0.5rem 0.55rem;
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.45;
}

.chat-popup__head-main {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  flex: 1;
}

.chat-popup__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 50%;
  color: #2563eb;
  background: linear-gradient(145deg, #eff6ff 0%, #dbeafe 100%);
  flex-shrink: 0;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.35);
}

.chat-popup__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.85rem 0.35rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
}

.chat-popup__menu {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  color: #334155;
  cursor: pointer;
}

.chat-popup__menu:hover,
.chat-popup__menu--active {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.chat-popup__head-text {
  min-width: 0;
  flex: 1;
}

.chat-popup__head-title-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.chat-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: #ecfdf5;
  color: #065f46;
  font-size: 0.65rem;
  font-weight: 700;
  border: 1px solid #a7f3d0;
  letter-spacing: 0.02em;
}

.chat-popup__head-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.chat-popup__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  color: #334155;
  cursor: pointer;
}

.chat-popup__icon-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.chat-popup__session-title {
  margin: 0.1rem 0 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-popup__history-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.12rem;
  width: 100%;
  padding: 0.55rem 0.65rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.chat-popup__history-item:hover {
  background: #f1f5f9;
}

.chat-popup__history-item--active,
.chat-popup__history-item--current {
  background: #eff6ff;
}

.chat-popup__history-item--active:hover,
.chat-popup__history-item--current:hover {
  background: #dbeafe;
}

.chat-popup__history-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: #0f172a;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

.chat-popup__history-meta {
  font-size: 0.68rem;
  color: #64748b;
}

.chat-popup__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--navy);
  font-family: var(--font-body);
}

.chat-popup__hint-inline {
  margin: 0;
  padding: 0.35rem 0.85rem 0.45rem;
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  flex-shrink: 0;
  border-bottom: 1px solid #f1f5f9;
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
}

.chat-popup__close:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

@keyframes chat-drawer-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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
  padding: 1.5rem 1rem;
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-popup :deep(.chat-panel) {
  border: none;
  border-radius: 0;
  padding-top: 0.45rem;
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
