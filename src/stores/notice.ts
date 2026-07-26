import { defineStore } from 'pinia'
import { ref } from 'vue'

export type NoticeKind = 'stock' | 'info' | 'error'

export const useNoticeStore = defineStore('notice', () => {
  const open = ref(false)
  const title = ref('')
  const message = ref('')
  const kind = ref<NoticeKind>('info')
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function dismiss() {
    clearTimer()
    open.value = false
  }

  function show(opts: {
    title?: string
    message: string
    kind?: NoticeKind
    durationMs?: number
  }) {
    clearTimer()
    title.value = opts.title ?? ''
    message.value = opts.message
    kind.value = opts.kind ?? 'info'
    open.value = true
    const ms = opts.durationMs ?? 2200
    if (ms > 0) {
      timer = setTimeout(() => {
        open.value = false
        timer = null
      }, ms)
    }
  }

  /** Thông báo hết hàng — ô gọn giữa màn hình */
  function showOutOfStock(productName?: string) {
    show({
      kind: 'stock',
      title: 'Hết hàng',
      message: productName
        ? `「${productName}」 đã hết hàng.`
        : 'Sản phẩm đã hết hàng.',
      durationMs: 2400,
    })
  }

  return { open, title, message, kind, show, showOutOfStock, dismiss }
})

export function isOutOfStockError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase()
  return (
    msg.includes('insufficient stock') ||
    msg.includes('hết hàng') ||
    msg.includes('het hang') ||
    msg.includes('không đủ tồn') ||
    msg.includes('khong du ton') ||
    msg.includes('out of stock')
  )
}
