<script setup lang="ts">
import { onMounted } from 'vue'
import { useChatWidgetStore } from '@/stores/chatWidget'

const widget = useChatWidgetStore()

onMounted(() => {
  widget.show()
})
</script>

<template>
  <div class="chat-redirect card card--flat">
    <h1>Trợ lý AI</h1>
    <p>Chatbot đã mở dạng popup góc phải — bạn có thể tiếp tục mua sắm và kéo sản phẩm vào chat.</p>
    <button type="button" class="btn btn-primary" @click="widget.show()">Mở lại trợ lý</button>
  </div>
</template>

<style scoped>
.chat-redirect {
  max-width: 420px;
  margin: 2rem auto;
  padding: 1.5rem;
  text-align: center;
}
.chat-redirect h1 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}
.chat-redirect p {
  margin: 0 0 1rem;
  color: var(--slate-600);
  line-height: 1.5;
  font-size: 0.9rem;
}
</style>
