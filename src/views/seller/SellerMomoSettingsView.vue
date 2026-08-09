<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { productApi, sellerMomoApi } from '@/api/services'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { resolvePublicAssetUrl } from '@/utils/productImage'

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
    error.value = e instanceof Error ? e.message : 'Không tải được cài đặt MoMo'
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
    success.value = 'Đã lưu thông tin MoMo — khách có thể chọn “Chuyển MoMo tới shop” khi mua sản phẩm của bạn.'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Lưu thất bại'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="seller-momo-page">
    <PageHeader
      eyebrow="Người bán"
      title="MoMo nhận tiền (QR / SĐT)"
      lead="Khách chuyển khoản trực tiếp tới ví MoMo của shop. Bạn xác nhận khi đã nhận đủ tiền trên đơn hàng."
    />

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="success" class="form-success">{{ success }}</p>

    <LoadingSpinner v-if="loading" label="Đang tải…" />

    <form v-else class="seller-momo-form" @submit.prevent="save">
      <div class="seller-momo-form__status" :data-configured="configured ? 'yes' : 'no'">
        {{ configured ? 'Đã bật cho checkout' : 'Chưa đủ thông tin — cần ít nhất SĐT hoặc ảnh QR' }}
      </div>

      <label class="seller-momo-field">
        <span>Số MoMo nhận tiền</span>
        <input
          v-model="momoPhone"
          type="tel"
          placeholder="0901234567"
          autocomplete="tel"
        />
      </label>

      <div class="seller-momo-field">
        <span>Ảnh QR MoMo (URL)</span>
        <input v-model="momoQrUrl" type="url" placeholder="https://… hoặc tải ảnh bên dưới" />
        <div class="seller-momo-upload">
          <label class="btn-interactive seller-momo-upload__btn">
            {{ uploading ? 'Đang tải ảnh…' : 'Tải ảnh QR lên' }}
            <input type="file" accept="image/*" hidden :disabled="uploading" @change="onQrFileChange" />
          </label>
        </div>
        <img
          v-if="momoQrPreviewUrl"
          :src="momoQrPreviewUrl"
          alt="QR MoMo"
          class="seller-momo-preview"
          loading="lazy"
        />
      </div>

      <p class="seller-momo-hint">
        Khách chỉ thấy tuỳ chọn này khi giỏ hàng chỉ có sản phẩm của bạn. Nội dung chuyển khoản tự động:
        <code>SEDSP DH#[mã đơn]</code>.
      </p>

      <button type="submit" class="btn-elegant-primary btn-interactive" :disabled="saving || uploading">
        {{ saving ? 'Đang lưu…' : 'Lưu cài đặt MoMo' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.seller-momo-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

.seller-momo-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 1.5rem;
}

.seller-momo-form__status {
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 0.9rem;
  background: #fef3c7;
  color: #92400e;
}

.seller-momo-form__status[data-configured='yes'] {
  background: #ecfdf5;
  color: #047857;
}

.seller-momo-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.seller-momo-field span {
  font-weight: 600;
  font-size: 0.9rem;
}

.seller-momo-field input {
  padding: 0.55rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.seller-momo-upload {
  margin-top: 0.35rem;
}

.seller-momo-upload__btn {
  display: inline-block;
  cursor: pointer;
  font-size: 0.875rem;
}

.seller-momo-preview {
  margin-top: 0.75rem;
  max-width: 220px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.seller-momo-hint {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.form-success {
  color: #047857;
  margin: 0.5rem 0;
}
</style>
