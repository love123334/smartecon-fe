<script setup lang="ts">
import type { DssAiInsightApi } from '@/api/real/dss'
import type { StructuredAiInsight } from '@/utils/sellerDssModuleAi'

defineProps<{
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
</script>

<template>
  <details class="dss-ai-collapse">
    <summary class="dss-ai-collapse__summary">
      <span class="dss-ai-collapse__label">{{ label ?? 'Nhận định AI' }}</span>
      <span v-if="backend && !backend.fallback" class="dss-ai-collapse__hint">
        AI · {{ backend.provider ?? 'API' }}
      </span>
      <span v-else-if="structured?.badge" class="dss-ai-collapse__hint">{{ structured.badge }}</span>
      <span v-else class="dss-ai-collapse__hint">Phân tích nội bộ</span>
    </summary>

    <div class="dss-ai-collapse__body">
      <p v-if="loading" class="dss-hint" role="status">Đang tổng hợp nhận định…</p>
      <p v-else-if="error" class="dss-alert dss-alert--warn" role="alert">{{ error }}</p>

      <template v-else-if="backend?.summary">
        <div class="dss-ai-collapse__head">
          <h3 class="dss-ai-collapse__title">{{ backend.title }}</h3>
          <span
            class="dss-badge"
            :class="backend.fallback ? 'dss-badge--muted' : 'dss-badge--best'"
          >
            {{ backend.fallback ? 'Phân tích nội bộ' : `AI · ${backend.provider ?? 'API'}` }}
          </span>
        </div>
        <div class="dss-ai-collapse__text" v-html="backend.summary.replace(/\n/g, '<br>')" />
        <p v-if="backend.disclaimer" class="dss-hint dss-ai-collapse__disclaimer">
          {{ backend.disclaimer }}
        </p>
      </template>

      <template v-else-if="structured">
        <div
          class="dss-ai-collapse__structured"
          :class="tone ? `dss-ai-collapse__structured--${tone}` : `dss-ai-collapse__structured--${structured.tone}`"
        >
          <div class="dss-ai-collapse__head">
            <span class="dss-ai-collapse__badge">{{ structured.badge }}</span>
            <h3 class="dss-ai-collapse__title">{{ structured.title }}</h3>
          </div>
          <p class="dss-ai-collapse__text">{{ structured.summary }}</p>
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
          <h3 class="dss-ai-collapse__title">{{ sec.title }}</h3>
          <pre class="dss-ai-collapse__pre">{{ sec.body }}</pre>
        </article>
      </template>

      <p v-else-if="plainText" class="dss-ai-collapse__text">{{ plainText }}</p>

      <p v-else class="dss-hint">Chưa có nhận định — chạy phân tích hoặc thử lại sau.</p>

      <slot />
    </div>
  </details>
</template>

<style scoped>
.dss-ai-collapse {
  margin-top: 1rem;
  border: 1px solid var(--slate-200, #dce3f0);
  border-radius: 12px;
  background: var(--slate-50, #f7f9fc);
  overflow: hidden;
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

.dss-ai-collapse__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem;
  justify-content: space-between;
  margin: 0.85rem 0 0.5rem;
}

.dss-ai-collapse__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.4;
}

.dss-ai-collapse__badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: var(--slate-200, #e8edf5);
  color: var(--slate-700, #334155);
}

.dss-ai-collapse__text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--slate-800, #14275c);
}

.dss-ai-collapse__disclaimer {
  margin-top: 0.65rem;
  font-size: 0.78rem;
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
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--slate-200, #dce3f0);
}

.dss-ai-collapse__pre {
  margin: 0.35rem 0 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--slate-700, #334155);
}

.dss-ai-collapse__structured--strong .dss-ai-collapse__badge {
  background: #dcfce7;
  color: #166534;
}

.dss-ai-collapse__structured--warn .dss-ai-collapse__badge {
  background: #fef3c7;
  color: #92400e;
}

.dss-ai-collapse__structured--soft .dss-ai-collapse__badge,
.dss-ai-collapse__structured--sparse .dss-ai-collapse__badge {
  background: #fee2e2;
  color: #991b1b;
}

.dss-badge--muted {
  background: var(--slate-100, #eef1f6);
  color: var(--slate-600, #5b6c93);
}
</style>
