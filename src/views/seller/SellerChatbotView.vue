<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import ChatAssistantPage from '@/components/ChatAssistantPage.vue'

const auth = useAuthStore()
const storageKey = computed(() =>
  auth.user ? `seller-${auth.user.id}` : 'seller-guest',
)
</script>

<template>
  <ChatAssistantPage role="seller" :storage-key="storageKey" />
</template>
