<script setup lang="ts">
import { computed } from 'vue'
import type { DssAiInsightApi } from '@/api/real/dss'
import type { StructuredAiInsight } from '@/utils/sellerDssModuleAi'
import { formatDssMarkdown } from '@/utils/formatDssMarkdown'

const props = defineProps<{
  /** Nhãn trên thanh dropdown (khi đóng). */
  label?: string
  backend?: DssAiInsightApi | null
  structured?: StructuredAiInsight | null
  /** Hub DSS — markdown sections từ insight plan. */
  sections?: { title: string; body: string }[]
  plainText?: string
  loading?: boolean
  error?: string
  tone?: string
}>()

const summaryLabel = computed(() => {
  if (props.label) return props.label
  if (props.backend?.title) return `Nhận định AI · ${props.backend.title}`
  return 'Nhận định AI'
})

const providerHint = computed(() => {
  if (props.backend && !props.backend.fallback) {
    return `AI · ${props.backend.provider ?? 'API'}`
  }
  if (props.structured?.badge) return props.structured.badge
  return 'Phân tích nội bộ'
})

const backendHtml = computed(() =>
  props.backend?.summary ? formatDssMarkdown(props.backend.summary) : '',
)

const plainHtml = computed(() =>
  props.plainText ? formatDssMarkdown(props.plainText) : '',
)

function sectionHtml(body: string): string {
  return formatDssMarkdown(body, { sanitize: false })
}
</script>

<template>
  <details class="dss-ai-collapse dss-ai-collapse--footer">
    <summary class="dss-ai-collapse__summary">
      <span class="dss-ai-collapse__label">{{ summaryLabel }}</span>
      <span class="dss-ai-collapse__hint">{{ providerHint }}</span>
    </summary>

    <div class="dss-ai-collapse__body">
      <p v-if="loading" class="dss-hint" role="status">Đang tổng hợp nhận định…</p>
      <p v-else-if="error" class="dss-alert dss-alert--warn" role="alert">{{ error }}</p>

      <template v-else-if="backend?.summary">
        <div class="dss-ai-collapse__prose" v-html="backendHtml" />
        <p v-if="backend.disclaimer" class="dss-hint dss-ai-collapse__disclaimer">
          {{ backend.disclaimer }}
        </p>
      </template>

      <template v-else-if="structured">
        <div
          class="dss-ai-collapse__structured"
          :class="
            tone
              ? `dss-ai-collapse__structured--${tone}`
              : `dss-ai-collapse__structured--${structured.tone}`
          "
        >
          <p class="dss-ai-collapse__lead">{{ structured.summary }}</p>
          <div v-if="structured.actions.length || structured.risks.length" class="dss-ai-collapse__cols">
            <div v-if="structured.actions.length">
              <h4>Kế hoạch đề xuất</h4>
              <ol>
                <li v-for="(a, i) in structured.actions" :key="`a-${i}`">{{ a }}</li>
              </ol>
            </div>
            <div v-if="structured.risks.length">
              <h4>Rủi ro cần theo dõi</h4>
              <ul>
                <li v-for="(r, i) in structured.risks" :key="`r-${i}`">{{ r }}</li>
              </ul>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="sections?.length">
        <article v-for="(sec, idx) in sections" :key="idx" class="dss-ai-collapse__section">
          <h3 class="dss-ai-collapse__section-title">{{ sec.title }}</h3>
          <div class="dss-ai-collapse__prose" v-html="sectionHtml(sec.body)" />
        </article>
      </template>

      <div v-else-if="plainText" class="dss-ai-collapse__prose" v-html="plainHtml" />

      <p v-else class="dss-hint">Chưa có nhận định — chạy phân tích hoặc thử lại sau.</p>

      <slot />
    </div>
  </details>
</template>

<style scoped>
.dss-ai-collapse {
  border: 1px solid var(--slate-200, #dce3f0);
  border-radius: 12px;
  background: var(--slate-50, #f7f9fc);
  overflow: hidden;
}

.dss-ai-collapse--footer {
  margin-top: 1.75rem;
  margin-bottom: 0.5rem;
}

.dss-ai-collapse__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.85rem 1rem;
  cursor: pointer;
  list-style: none;
  font-weight: 600;
  color: var(--slate-800, #14275c);
  user-select: none;
}

.dss-ai-collapse__summary::-webkit-details-marker {
  display: none;
}

.dss-ai-collapse__summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 0.35rem;
  transition: transform 0.15s ease;
  color: var(--brand-600, #2563eb);
}

.dss-ai-collapse[open] .dss-ai-collapse__summary::before {
  transform: rotate(90deg);
}

.dss-ai-collapse__label {
  flex: 1 1 auto;
}

.dss-ai-collapse__hint {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--slate-500, #6b7a99);
  background: var(--white, #fff);
  border: 1px solid var(--slate-200, #dce3f0);
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
}

.dss-ai-collapse__body {
  padding: 0 1rem 1rem;
  border-top: 1px solid var(--slate-200, #dce3f0);
}

.dss-ai-collapse__prose :deep(.dss-md-h) {
  margin: 1rem 0 0.45rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--slate-700, #334155);
}

.dss-ai-collapse__prose :deep(.dss-md-h:first-child) {
  margin-top: 0.75rem;
}

.dss-ai-collapse__prose :deep(.dss-md-p) {
  margin: 0.35rem 0 0.5rem;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--slate-800, #14275c);
}

.dss-ai-collapse__prose :deep(.dss-md-ol),
.dss-ai-collapse__prose :deep(.dss-md-ul) {
  margin: 0.25rem 0 0.75rem;
  padding-left: 1.25rem;
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--slate-800, #14275c);
}

.dss-ai-collapse__prose :deep(li + li) {
  margin-top: 0.35rem;
}

.dss-ai-collapse__prose :deep(strong) {
  font-weight: 700;
  color: var(--slate-900, #0f172a);
}

.dss-ai-collapse__disclaimer {
  margin-top: 0.75rem;
  font-size: 0.78rem;
}

.dss-ai-collapse__lead {
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
  line-height: 1.55;
}

.dss-ai-collapse__cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 0.85rem;
}

.dss-ai-collapse__cols h4 {
  margin: 0 0 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--slate-600, #5b6c93);
}

.dss-ai-collapse__cols ol,
.dss-ai-collapse__cols ul {
  margin: 0;
  padding-left: 1.15rem;
  font-size: 0.86rem;
  line-height: 1.45;
}

.dss-ai-collapse__section + .dss-ai-collapse__section {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--slate-200, #dce3f0);
}

.dss-ai-collapse__section-title {
  margin: 0.75rem 0 0.25rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--slate-700, #334155);
}

.dss-ai-collapse__structured--strong .dss-ai-collapse__hint {
  background: #dcfce7;
  color: #166534;
}
</style>
