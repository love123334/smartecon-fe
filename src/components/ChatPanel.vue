<script setup lang="ts">
import { nextTick, ref, watch, computed } from 'vue'
import type { ChatMessage, ChatProductRef, ChatSuggestedAction } from '@/types'
import type { QuickPrompt } from '@/api/chat/prompts'
import { formatChatHtml } from '@/api/chat/engine'
import { parseDraggedProduct } from '@/api/chat/productCards'
import ChatProductMiniCard from '@/components/ChatProductMiniCard.vue'
import ChatReviewSummaryCard from '@/components/ChatReviewSummaryCard.vue'
import ChatSellerMiniCard from '@/components/ChatSellerMiniCard.vue'
import ChatOrderActionCard from '@/components/ChatOrderActionCard.vue'
import ChatBotIcon from '@/components/icons/ChatBotIcon.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  messages: ChatMessage[]
  placeholder?: string
  emptyText?: string
  quickPrompts?: QuickPrompt[]
  loading?: boolean
  attachments?: ChatProductRef[]
  compact?: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  clear: []
  'attach-product': [product: ChatProductRef]
  'remove-attachment': [id: string]
  navigate: [path: string]
}>()

const auth = useAuthStore()
const input = ref('')
const listEl = ref<HTMLElement | null>(null)
const dropActive = ref(false)
const isDev = import.meta.env.DEV

function isOrderUpdateMessage(m: ChatMessage): boolean {
  if (m.meta?.kind === 'order_update' || m.meta?.orderId) return true
  if (m.role === 'assistant' && (/#\d+|đơn\s+\d+/i.test(m.content) && (/đặt đơn|thanh toán|giao hàng|hủy|cập nhật đơn/i.test(m.content)))) return true
  return false
}

const visibleQuickPrompts = computed(() =>
  (props.quickPrompts ?? []).filter((p) => p.text.trim()),
)

/** Chỉ hiện deep-link / chip trên bubble assistant mới nhất */
const latestAssistantId = computed(() => {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    const m = props.messages[i]
    if (m.role === 'assistant' && !m.pending) return m.id
  }
  return null
})

function actionsFor(m: ChatMessage): ChatSuggestedAction[] {
  if (m.role !== 'assistant' || m.id !== latestAssistantId.value) return []
  return m.meta?.suggestedActions?.filter((a) => a.label?.trim()) ?? []
}

function onAction(a: ChatSuggestedAction) {
  if (a.to?.startsWith('/')) {
    emit('navigate', a.to)
    return
  }
  const prompt = a.prompt?.trim()
  if (prompt && !props.loading) emit('send', prompt)
}

async function scrollEnd() {
  await nextTick()
  // Instant scroll — smooth gây giật khi nhiều bubble/product card
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

watch(
  () => [props.messages.length, props.loading, props.attachments?.length],
  () => {
    void scrollEnd()
  },
)

async function submit(): Promise<void> {
  const text = input.value.trim()
  if ((!text && !props.attachments?.length) || props.loading) return
  input.value = ''
  emit('send', text)
}

function usePrompt(p: QuickPrompt) {
  if (props.loading || !p.text.trim()) return
  emit('send', p.text)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dropActive.value = true
}

function onDragLeave(e: DragEvent) {
  // Only clear when leaving the panel itself (not child nodes)
  const root = e.currentTarget as HTMLElement
  const related = e.relatedTarget as Node | null
  if (related && root.contains(related)) return
  dropActive.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dropActive.value = false
  const product = parseDraggedProduct(e.dataTransfer)
  if (product) emit('attach-product', product)
}

defineExpose({ scrollToEnd: scrollEnd })
</script>

<template>
  <div
    class="chat-panel"
    :class="{ 'chat-panel--compact': compact, 'chat-panel--drop': dropActive }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div v-if="visibleQuickPrompts.length" class="chat-quick">
      <button
        v-for="p in visibleQuickPrompts"
        :key="`${p.label}|${p.text}`"
        type="button"
        class="chat-quick__chip btn-interactive"
        :disabled="loading"
        :title="p.text"
        @click="usePrompt(p)"
      >
        {{ p.label }}
      </button>
    </div>

    <div ref="listEl" class="chat-messages" :class="{ 'chat-messages--compact': compact }">
      <div v-if="!messages.length" class="chat-empty">
        <span class="chat-empty__avatar" aria-hidden="true">
          <ChatBotIcon :size="48" />
        </span>
        <p class="empty empty--dashed">
          {{ emptyText ?? 'Xin chào! Hãy đặt câu hỏi.' }}
        </p>
      </div>
      <TransitionGroup v-else name="chat-msg" tag="div" class="chat-list">
        <div
          v-for="m in messages"
          :key="m.id"
          :class="[
            'chat-row',
            m.role === 'user' ? 'chat-row--user' : 'chat-row--assistant',
          ]"
        >
          <span v-if="m.role !== 'user'" class="chat-row__avatar" aria-hidden="true">
            <ChatBotIcon :size="36" />
          </span>
          <div
            :class="[
              'chat-bubble',
              m.role === 'user' ? 'user' : 'assistant',
              m.meta?.kind === 'order_update' ? 'chat-bubble--order' : '',
            ]"
          >
            <div v-if="m.attachments?.length" class="chat-bubble__attach">
              <ChatProductMiniCard
                v-for="p in m.attachments"
                :key="`att-${m.id}-${p.id}`"
                :product="p"
                compact
              />
            </div>
            <p class="chat-bubble__text" v-html="formatChatHtml(m.content)" />
            <div v-if="actionsFor(m).length" class="chat-bubble__nav" role="group" aria-label="Mở trang liên quan">
              <button
                v-for="a in actionsFor(m)"
                :key="`${m.id}-${a.id}`"
                type="button"
                class="chat-nav-chip"
                :title="a.to || a.prompt"
                @click="onAction(a)"
              >
                {{ a.label }}
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <ChatReviewSummaryCard
              v-if="m.reviewSummary?.productId"
              :summary="m.reviewSummary"
            />
            <div v-if="m.sellers?.length" class="chat-bubble__sellers">
              <ChatSellerMiniCard
                v-for="s in m.sellers"
                :key="`seller-${m.id}-${s.sellerId}`"
                :seller="s"
                :compact="Boolean(m.products?.length)"
              />
            </div>
            <div v-if="m.products?.length" class="chat-bubble__products">
              <ChatProductMiniCard
                v-for="p in m.products"
                :key="`prod-${m.id}-${p.id}`"
                :product="p"
              />
            </div>
            <ChatOrderActionCard
              v-if="isOrderUpdateMessage(m)"
              :order-id="m.meta?.orderId"
              :message-content="m.content"
              :role="auth.role"
              @navigate="emit('navigate', $event)"
            />
            <span v-if="m.meta?.kind === 'order_update'" class="chat-bubble__tag chat-bubble__tag--order">
              Cập nhật đơn
            </span>
            <span
              v-else-if="m.meta?.source === 'local' && m.reviewSummary?.hasReviews"
              class="chat-bubble__tag chat-bubble__tag--local"
            >Tóm từ đánh giá người mua</span>
            <span
              v-else-if="m.meta?.source === 'local' && isDev"
              class="chat-bubble__tag chat-bubble__tag--local"
            >Dữ liệu hệ thống</span>
            <span
              v-else-if="m.meta?.source === 'llm_repaired'"
              class="chat-bubble__tag chat-bubble__tag--local"
            >AI · đối chiếu dữ liệu</span>
            <span v-else-if="m.meta?.source === 'llm'" class="chat-bubble__tag">AI</span>
            <time class="chat-bubble__time">{{
              new Date(m.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            }}</time>
          </div>
        </div>
        <div v-if="loading" key="typing" class="chat-row chat-row--assistant">
          <span class="chat-row__avatar" aria-hidden="true">
            <ChatBotIcon :size="36" />
          </span>
          <div class="chat-bubble assistant chat-bubble--typing">
            <span class="typing-dots" aria-label="Đang trả lời"><i /><i /><i /></span>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div v-if="dropActive" class="chat-drop-hint" aria-hidden="true">
      Thả sản phẩm vào đây để đính kèm
    </div>

    <div v-if="attachments?.length" class="chat-attach-bar">
      <span class="chat-attach-bar__label">Đính kèm</span>
      <div class="chat-attach-bar__chips">
        <button
          v-for="p in attachments"
          :key="p.id"
          type="button"
          class="chat-attach-chip"
          :title="`Gỡ ${p.name}`"
          @click="emit('remove-attachment', p.id)"
        >
          <img :src="p.imageUrl" alt="" />
          <span>{{ p.name }}</span>
          <em aria-hidden="true">×</em>
        </button>
      </div>
    </div>

    <form class="chat-form" @submit.prevent="submit">
      <input
        v-model="input"
        type="text"
        :placeholder="
          attachments?.length
            ? 'Hỏi về SP đính kèm (so sánh, giá, tồn…) hoặc kéo thêm SP'
            : (placeholder ?? 'Nhập câu hỏi… · kéo SP vào chat để đính kèm')
        "
        :disabled="loading"
        autocomplete="off"
      />
      <button
        type="button"
        class="btn btn-outline btn-sm"
        :disabled="loading || !messages.length"
        @click="emit('clear')"
      >
        Xóa
      </button>
      <button
        type="submit"
        class="btn btn-primary"
        :disabled="loading || (!input.trim() && !attachments?.length)"
      >
        {{ loading ? '...' : 'Gửi' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.chat-panel {
  position: relative;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  border-radius: var(--radius-lg);
  background: #fff;
  border: 1px solid transparent;
  font-family: var(--font-body);
  color: var(--color-text);
  line-height: 1.68;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.chat-panel--drop {
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.18);
}

.chat-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.chat-quick__chip {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
  font-family: var(--font-body);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: all 0.2s ease;
}

.chat-quick__chip:hover:not(:disabled) {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(59, 130, 246, 0.15);
}

.chat-quick__chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-messages {
  min-height: 290px;
  max-height: 440px;
  margin-bottom: 0;
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow-y: auto;
  flex: 1;
}

.chat-messages--compact {
  min-height: 0;
  max-height: none;
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chat-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  max-width: 100%;
}

.chat-row--user {
  justify-content: flex-end;
}

.chat-row--assistant {
  justify-content: flex-start;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 0.5rem;
  text-align: center;
}

.chat-empty__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  color: #2563eb;
  background: linear-gradient(145deg, #eff6ff 0%, #dbeafe 100%);
  border: 2px solid #fff;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.25);
}

.chat-row__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  color: #2563eb;
  background: linear-gradient(145deg, #eff6ff 0%, #dbeafe 100%);
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 0.15rem;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.22);
}

.chat-bubble {
  max-width: 90%;
  padding: 0.75rem 0.95rem;
  border-radius: 16px;
  box-sizing: border-box;
}

.chat-bubble__text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 0.875rem;
  font-family: var(--font-body);
}

.chat-bubble__text :deep(strong) {
  font-weight: 700;
  color: inherit;
}

.chat-bubble__text :deep(a.chat-inline-link) {
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.8125rem;
}

.chat-bubble__text :deep(a.chat-inline-link:hover) {
  text-decoration: underline;
}

.chat-bubble__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.55rem;
}

.chat-nav-chip {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.3;
  cursor: pointer;
  transition: all 0.18s ease;
}

.chat-nav-chip:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
  transform: translateY(-1px);
}

.chat-nav-chip span {
  opacity: 0.65;
  font-size: 0.65rem;
}

.chat-bubble.assistant .chat-bubble__text :deep(strong) {
  color: #0f172a;
}

.chat-bubble__products,
.chat-bubble__attach,
.chat-bubble__sellers {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.45rem;
  margin-top: 0.65rem;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

@media (min-width: 420px) {
  .chat-bubble__products {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.chat-bubble.user .chat-bubble__attach {
  margin-top: 0;
  margin-bottom: 0.45rem;
}

.chat-bubble--order {
  border-left: 4px solid #2563eb;
  border-color: #93c5fd;
  background: linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%);
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05);
}

.chat-bubble__tag--order {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #fff;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
}

.chat-bubble__tag {
  display: inline-block;
  margin-top: 0.4rem;
  padding: 0.15rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 6px;
  background: #ecfdf5;
  color: #065f46;
}

.chat-bubble__tag--local {
  background: #f1f5f9;
  color: #475569;
}

.chat-bubble__time {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.625rem;
  opacity: 0.65;
}

.chat-bubble.user {
  align-self: flex-end;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.28);
}

.chat-bubble.assistant {
  align-self: flex-start;
  background: #ffffff;
  color: #1e293b;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-bottom-left-radius: 4px;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.06);
}

.chat-bubble--typing {
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.typing-dots {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
}

.typing-dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%);
  box-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
  animation: chat-typing 1.1s infinite ease-in-out;
}

.typing-dots i:nth-child(2) {
  animation-delay: 0.15s;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
}

.typing-dots i:nth-child(3) {
  animation-delay: 0.3s;
  background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
}

@keyframes chat-typing {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0) scale(0.9);
  }
  40% {
    opacity: 1;
    transform: translateY(-4px) scale(1.15);
  }
}

.chat-drop-hint {
  position: absolute;
  inset: 3.5rem 1rem 4.5rem;
  display: grid;
  place-items: center;
  pointer-events: none;
  border: 2px dashed var(--primary-500);
  border-radius: var(--radius-lg);
  background: rgba(240, 253, 250, 0.92);
  color: var(--primary-700, #0f766e);
  font-weight: 700;
  font-size: 0.875rem;
  z-index: 2;
}

.chat-attach-bar {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin-top: 0.55rem;
  flex-shrink: 0;
}

.chat-attach-bar__label {
  flex-shrink: 0;
  margin-top: 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.chat-attach-bar__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 0;
}

.chat-attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 160px;
  padding: 0.2rem 0.4rem 0.2rem 0.2rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--slate-50);
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 600;
}

.chat-attach-chip img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}

.chat-attach-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-attach-chip em {
  font-style: normal;
  opacity: 0.55;
}

.chat-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
  align-items: center;
  flex-shrink: 0;
}

.chat-form input {
  flex: 1 1 140px;
  min-width: 0;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font: inherit;
  font-size: 0.84rem;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.chat-form input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.2);
}

.chat-form input:disabled {
  opacity: 0.7;
}
</style>
