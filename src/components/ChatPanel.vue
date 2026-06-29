<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { ChatMessage } from '@/types'
import type { QuickPrompt } from '@/api/chat/prompts'

const props = defineProps<{
  messages: ChatMessage[]
  placeholder?: string
  emptyText?: string
  quickPrompts?: QuickPrompt[]
  loading?: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  clear: []
}>()

const input = ref('')
const listEl = ref<HTMLElement | null>(null)

async function scrollEnd() {
  await nextTick()
  listEl.value?.scrollTo({ top: listEl.value.scrollHeight, behavior: 'smooth' })
}

watch(
  () => props.messages.length,
  () => {
    void scrollEnd()
  },
)

async function submit(): Promise<void> {
  const text = input.value.trim()
  if (!text || props.loading) return
  input.value = ''
  emit('send', text)
}

function usePrompt(text: string) {
  if (props.loading) return
  emit('send', text)
}

defineExpose({ scrollToEnd: scrollEnd })
</script>

<template>
  <div class="chat-panel card card--flat">
    <div v-if="quickPrompts?.length" class="chat-quick">
      <button
        v-for="p in quickPrompts"
        :key="p.label"
        type="button"
        class="chat-quick__chip btn-interactive"
        :disabled="loading"
        @click="usePrompt(p.text)"
      >
        {{ p.label }}
      </button>
    </div>

    <div ref="listEl" class="chat-messages chat-messages--panel">
      <p v-if="!messages.length" class="empty empty--dashed">
        {{ emptyText ?? 'Xin chào! Hãy đặt câu hỏi.' }}
      </p>
      <TransitionGroup v-else name="chat-msg" tag="div" class="chat-list">
        <div
          v-for="m in messages"
          :key="m.id"
          :class="['chat-bubble', m.role === 'user' ? 'user' : 'assistant']"
        >
          <p class="chat-bubble__text">{{ m.content }}</p>
          <time class="chat-bubble__time">{{
            new Date(m.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          }}</time>
        </div>
        <div v-if="loading" key="typing" class="chat-bubble assistant chat-bubble--typing">
          <span class="typing-dots" aria-label="Đang trả lời"><i /><i /><i /></span>
        </div>
      </TransitionGroup>
    </div>

    <form class="chat-form" @submit.prevent="submit">
      <input
        v-model="input"
        type="text"
        :placeholder="placeholder ?? 'Nhập câu hỏi...'"
        :disabled="loading"
        autocomplete="off"
      />
      <button type="button" class="btn btn-outline btn-sm" :disabled="loading || !messages.length" @click="emit('clear')">
        Xóa
      </button>
      <button type="submit" class="btn btn-primary" :disabled="loading || !input.trim()">
        {{ loading ? '...' : 'Gửi' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.chat-panel {
  padding: 1rem 1.15rem;
}

.chat-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.chat-quick__chip {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--slate-50);
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--transition), background var(--transition);
}

.chat-quick__chip:hover:not(:disabled) {
  border-color: var(--primary-500);
  background: var(--primary-50);
}

.chat-messages--panel {
  min-height: 320px;
  max-height: 420px;
  margin-bottom: 0;
  padding: 0.75rem;
  background: var(--slate-50);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow-y: auto;
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.chat-bubble {
  max-width: 88%;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-lg);
}

.chat-bubble__text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.5;
  font-size: 0.875rem;
}

.chat-bubble__time {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.65rem;
  opacity: 0.65;
}

.chat-bubble.user {
  align-self: flex-end;
  background: var(--primary-600);
  color: #fff;
  border-bottom-right-radius: 0.25rem;
}

.chat-bubble.assistant {
  align-self: flex-start;
  background: #fff;
  border: 1px solid var(--color-border);
  border-bottom-left-radius: 0.25rem;
}

.chat-bubble--typing {
  padding: 0.75rem 1rem;
}

.typing-dots {
  display: inline-flex;
  gap: 0.25rem;
}

.typing-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--slate-400);
  animation: chat-typing 1.2s infinite ease-in-out;
}

.typing-dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dots i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes chat-typing {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.chat-form {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  align-items: center;
}

.chat-form input {
  flex: 1;
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font: inherit;
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
