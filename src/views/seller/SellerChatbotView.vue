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
    <h1>Trợ lý AI người bán</h1>
    <p>Chatbot mở dạng popup — kéo sản phẩm từ danh sách SP để hỏi DSS / so sánh nhanh.</p>
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
