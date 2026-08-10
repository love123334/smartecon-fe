<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { productApi, sellerMomoApi } from '@/api/services'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { resolvePublicAssetUrl } from '@/utils/productImage'

const props = withDefaults(
  defineProps<{
    compact?: boolean
    sellerMode?: boolean
  }>(),
  { compact: false, sellerMode: false },
)

const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
const success = ref('')

const momoPhone = ref('')
const momoQrUrl = ref('')
const configured = ref(false)
const momoQrPreviewUrl = computed(() => resolvePublicAssetUrl(momoQrUrl.value))

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const settings = await sellerMomoApi.getMySettings()
    momoPhone.value = settings.momoPhone ?? ''
    momoQrUrl.value = settings.momoQrUrl ?? ''
    configured.value = settings.configured
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Không tải được ví MoMo'
  } finally {
    loading.value = false
  }
})

async function onQrFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  error.value = ''
  try {
    const uploaded = await productApi.uploadImage(file)
    momoQrUrl.value = uploaded.url
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Không tải được ảnh QR'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function save() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const settings = await sellerMomoApi.updateSettings({
      momoPhone: momoPhone.value.trim() || null,
      momoQrUrl: momoQrUrl.value.trim() || null,
    })
    configured.value = settings.configured
    momoPhone.value = settings.momoPhone ?? ''
    momoQrUrl.value = settings.momoQrUrl ?? ''
    success.value = props.sellerMode
      ? 'Đã lưu — khách có thể chuyển MoMo tới shop khi mua hàng.'
      : 'Đã liên kết ví MoMo.'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Lưu thất bại'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section id="momo-wallet" class="momo-wallet" :class="{ 'momo-wallet--compact': compact }">
    <header class="momo-wallet__head">
      <h2 class="momo-wallet__title">Ví MoMo</h2>
      <p class="momo-wallet__lead">
        <template v-if="sellerMode">
          SĐT hoặc QR nhận tiền từ khách. Thanh toán thành công sẽ tự xác nhận đơn.
        </template>
        <template v-else>
          Liên kết SĐT MoMo để thanh toán nhanh hơn khi mua hàng.
        </template>
      </p>
    </header>

    <LoadingSpinner v-if="loading" />
    <template v-else>
      <p v-if="error" class="form-error">{{ error }}</p>
      <p v-if="success" class="alert alert-success">{{ success }}</p>

      <div class="form-group">
        <label for="momo-phone">Số MoMo</label>
        <input
          id="momo-phone"
          v-model="momoPhone"
          type="tel"
          inputmode="tel"
          placeholder="VD: 0901234567"
        />
      </div>

      <div class="form-group">
        <label for="momo-qr">Ảnh QR MoMo (tuỳ chọn)</label>
        <input id="momo-qr" type="file" accept="image/*" @change="onQrFileChange" />
        <p v-if="uploading" class="elegant-muted">Đang tải ảnh…</p>
        <img
          v-if="momoQrPreviewUrl"
          :src="momoQrPreviewUrl"
          alt="QR MoMo"
          class="momo-wallet__qr-preview"
        />
      </div>

      <p v-if="configured" class="momo-wallet__status">Đã liên kết ví MoMo</p>

      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        {{ saving ? 'Đang lưu…' : 'Lưu ví MoMo' }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.momo-wallet {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border, #e5e7eb);
}

.momo-wallet--compact {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.momo-wallet__head {
  margin-bottom: 1rem;
}

.momo-wallet__title {
  font-size: 1.1rem;
  margin: 0 0 0.35rem;
}

.momo-wallet__lead {
  margin: 0;
  font-size: 0.9rem;
  color: #6b7280;
  line-height: 1.45;
}

.momo-wallet__qr-preview {
  display: block;
  margin-top: 0.75rem;
  max-width: 160px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.momo-wallet__status {
  font-size: 0.875rem;
  color: #047857;
  margin: 0 0 0.75rem;
}
</style>
