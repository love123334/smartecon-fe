import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatProductRef } from '@/types'

export const useChatWidgetStore = defineStore('chatWidget', () => {
  const open = ref(false)
  const attachments = ref<ChatProductRef[]>([])
  const dragOver = ref(false)

  function toggle() {
    open.value = !open.value
  }

  function show() {
    open.value = true
  }

  function hide() {
    open.value = false
    dragOver.value = false
  }

  function addAttachment(product: ChatProductRef) {
    if (attachments.value.some((p) => p.id === product.id)) return
    if (attachments.value.length >= 4) {
      attachments.value = [...attachments.value.slice(1), product]
      return
    }
    attachments.value = [...attachments.value, product]
  }

  function removeAttachment(id: string) {
    attachments.value = attachments.value.filter((p) => p.id !== id)
  }

  function clearAttachments() {
    attachments.value = []
  }

  function setAttachments(next: ChatProductRef[]) {
    attachments.value = next
  }

  return {
    open,
    attachments,
    dragOver,
    toggle,
    show,
    hide,
    addAttachment,
    removeAttachment,
    clearAttachments,
    setAttachments,
  }
})
