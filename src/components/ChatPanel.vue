<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ChatMessage } from '@/types'

defineProps<{
  messages: ChatMessage[]
  placeholder?: string
  emptyText?: string
}>()

const emit = defineEmits<{
  send: [text: string]
}>()

const input = ref('')
const listEl = ref<HTMLElement | null>(null)

async function submit(): Promise<void> {
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  emit('send', text)
  await nextTick()
  listEl.value?.scrollTo({ top: listEl.value.scrollHeight, behavior: 'smooth' })
}

defineExpose({ scrollToEnd: () => listEl.value?.scrollTo({ top: listEl.value?.scrollHeight ?? 0 }) })
</script>

<template>
  <div class="chat-panel card card--flat">
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
          {{ m.content }}
        </div>
      </TransitionGroup>
    </div>
    <form class="chat-form" @submit.prevent="submit">
      <input
        v-model="input"
        type="text"
        :placeholder="placeholder ?? 'Nhập câu hỏi...'"
        autocomplete="off"
      />
      <button type="submit" class="btn btn-primary">Gửi</button>
    </form>
  </div>
</template>

<style scoped>
.chat-panel {
  padding: 1rem 1.15rem;
}

.chat-messages--panel {
  min-height: 320px;
  max-height: 420px;
  margin-bottom: 0;
  padding: 0.25rem;
  background: var(--slate-50);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.chat-form {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
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
</style>
