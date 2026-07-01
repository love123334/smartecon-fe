<script setup lang="ts">
import { ref } from 'vue'
import { AVATAR_PRESETS, readAvatarFile } from '@/utils/avatar'
import UserAvatar from '@/components/UserAvatar.vue'

const props = defineProps<{
  name: string
  avatarPreset?: string
  avatarUrl?: string
}>()

const emit = defineEmits<{
  change: [data: { avatarPreset?: string; avatarUrl?: string }]
}>()

const uploading = ref(false)
const uploadError = ref('')

function selectPreset(id: string) {
  emit('change', { avatarPreset: id, avatarUrl: undefined })
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    const dataUrl = await readAvatarFile(file)
    emit('change', { avatarUrl: dataUrl, avatarPreset: undefined })
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Tải ảnh thất bại'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function clearUpload() {
  emit('change', { avatarUrl: undefined, avatarPreset: props.avatarPreset ?? 'default' })
}
</script>

<template>
  <div class="avatar-picker">
    <div class="avatar-picker__preview">
      <UserAvatar
        :name="name"
        :avatar-preset="avatarPreset"
        :avatar-url="avatarUrl"
        size="lg"
      />
      <div>
        <p class="avatar-picker__title">Ảnh đại diện</p>
        <p class="avatar-picker__hint">Chọn icon có sẵn hoặc tải ảnh lên (tối đa ~270KB)</p>
      </div>
    </div>

    <div class="avatar-picker__grid">
      <button
        v-for="p in AVATAR_PRESETS"
        :key="p.id"
        type="button"
        class="avatar-picker__option"
        :class="{ 'avatar-picker__option--active': !avatarUrl && (avatarPreset ?? 'default') === p.id }"
        :title="p.label"
        @click="selectPreset(p.id)"
      >
        <span class="avatar-picker__emoji" :style="{ background: p.bg }">{{ p.emoji }}</span>
        <span class="avatar-picker__label">{{ p.label }}</span>
      </button>
    </div>

    <div class="avatar-picker__upload">
      <label class="btn btn-outline btn-sm avatar-picker__file-btn">
        {{ uploading ? 'Đang tải...' : 'Tải ảnh lên' }}
        <input type="file" accept="image/*" hidden :disabled="uploading" @change="onFileChange" />
      </label>
      <button
        v-if="avatarUrl"
        type="button"
        class="btn btn-ghost btn-sm"
        @click="clearUpload"
      >
        Xóa ảnh tùy chỉnh
      </button>
    </div>
    <p v-if="uploadError" class="avatar-picker__error">{{ uploadError }}</p>
  </div>
</template>

<style scoped>
.avatar-picker {
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.avatar-picker__preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.avatar-picker__title {
  margin: 0 0 0.2rem;
  font-weight: 700;
  font-size: 0.9375rem;
}

.avatar-picker__hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--slate-500);
}

.avatar-picker__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

@media (max-width: 480px) {
  .avatar-picker__grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.avatar-picker__option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem;
  border: 2px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--transition), background var(--transition);
}

.avatar-picker__option:hover {
  background: var(--slate-50);
}

.avatar-picker__option--active {
  border-color: var(--primary-500);
  background: var(--primary-50);
}

.avatar-picker__emoji {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 1.25rem;
}

.avatar-picker__label {
  font-size: 0.625rem;
  color: var(--slate-600);
}

.avatar-picker__upload {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.avatar-picker__file-btn {
  cursor: pointer;
}

.avatar-picker__error {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: #b91c1c;
}
</style>
