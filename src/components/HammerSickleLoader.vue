<script setup lang="ts">
withDefaults(
  defineProps<{
    /** sm = chat/inline, md = page default, lg = full-screen feel */
    size?: 'sm' | 'md' | 'lg'
    label?: string
    showBang?: boolean
  }>(),
  {
    size: 'md',
    label: 'Đang tải...',
    showBang: true,
  },
)
</script>

<template>
  <div
    class="hs-loader"
    :class="`hs-loader--${size}`"
    role="status"
    aria-live="polite"
  >
    <div class="hs-loader__wrap" aria-hidden="true">
      <svg class="hs-loader__ring" viewBox="0 0 100 100">
        <circle class="hs-loader__track" cx="50" cy="50" r="42" />
        <circle class="hs-loader__arc" cx="50" cy="50" r="42" />
      </svg>

      <div class="hs-loader__flash" />

      <div class="hs-loader__tool hs-loader__tool--hammer">
        <svg viewBox="0 0 100 100">
          <line x1="18" y1="18" x2="82" y2="82" stroke="var(--hs-handle)" stroke-width="9" stroke-linecap="round" />
          <rect
            x="1"
            y="11"
            width="34"
            height="14"
            rx="2"
            fill="var(--hs-hammer-head)"
            stroke="var(--hs-hammer-stroke)"
            stroke-width="1.5"
            transform="rotate(-45 18 18)"
          />
        </svg>
      </div>

      <div class="hs-loader__tool hs-loader__tool--sickle">
        <svg viewBox="0 0 100 100">
          <line x1="82" y1="18" x2="18" y2="82" stroke="var(--hs-handle)" stroke-width="9" stroke-linecap="round" />
          <path
            d="M 66 6 A 22 22 0 1 1 46 34"
            fill="none"
            stroke="var(--hs-sickle)"
            stroke-width="9"
            stroke-linecap="round"
          />
        </svg>
      </div>
    </div>

    <p v-if="label" class="hs-loader__label">
      {{ label.replace(/\.\.\.$/, '') }}<span v-if="showBang" class="hs-loader__bang"> 💥</span>...
    </p>
  </div>
</template>

<style scoped>
.hs-loader {
  --hs-track: rgba(46, 125, 246, 0.12);
  --hs-arc: var(--primary-600, #2e7df6);
  --hs-handle: #8a6a45;
  --hs-hammer-head: var(--slate-300, #d4d4d4);
  --hs-hammer-stroke: var(--slate-500, #737373);
  --hs-sickle: var(--primary-500, #2e7df6);
  --hs-flash-core: #ffffff;
  --hs-flash-glow: var(--primary-300, #80b0ff);
  --hs-label: var(--color-text-muted, var(--navy-soft, #5b6c93));

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  color: var(--hs-label);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
}

.hs-loader--sm {
  --hs-size: 72px;
  --hs-tool: 28px;
  font-size: 0.8125rem;
  gap: 0.5rem;
  padding: 0.5rem;
}

.hs-loader--md {
  --hs-size: 96px;
  --hs-tool: 36px;
}

.hs-loader--lg {
  --hs-size: 132px;
  --hs-tool: 46px;
  font-size: 0.9375rem;
  gap: 1rem;
}

.hs-loader__wrap {
  position: relative;
  width: var(--hs-size);
  height: var(--hs-size);
  flex-shrink: 0;
}

.hs-loader__ring {
  width: 100%;
  height: 100%;
  animation: hs-spin 1.4s linear infinite;
}

.hs-loader__track {
  fill: none;
  stroke: var(--hs-track);
  stroke-width: 5;
}

.hs-loader__arc {
  fill: none;
  stroke: var(--hs-arc);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 250;
  stroke-dashoffset: 175;
}

@keyframes hs-spin {
  to {
    transform: rotate(360deg);
  }
}

.hs-loader__flash {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--hs-flash-core) 0%, var(--hs-flash-glow) 35%, transparent 70%);
  opacity: 0;
  animation: hs-flash 2.6s ease-in-out infinite;
  pointer-events: none;
  z-index: 3;
}

@keyframes hs-flash {
  0%,
  84%,
  100% {
    opacity: 0;
    transform: scale(0.4);
  }
  90% {
    opacity: 1;
    transform: scale(3.2);
  }
  95% {
    opacity: 0;
    transform: scale(4.4);
  }
}

.hs-loader__tool {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--hs-tool);
  height: var(--hs-tool);
  margin: calc(var(--hs-tool) / -2) 0 0 calc(var(--hs-tool) / -2);
  filter: drop-shadow(0 2px 3px rgba(20, 39, 92, 0.18));
}

.hs-loader__tool svg {
  width: 100%;
  height: 100%;
  display: block;
}

.hs-loader__tool--hammer {
  animation: hs-hammer 2.6s cubic-bezier(0.5, 0.05, 0.4, 1) infinite;
  z-index: 2;
}

.hs-loader__tool--sickle {
  animation: hs-sickle 2.6s cubic-bezier(0.5, 0.05, 0.4, 1) infinite;
  z-index: 1;
}

@keyframes hs-hammer {
  0% {
    transform: translateY(calc(var(--hs-size) * -0.24)) rotate(0deg);
  }
  78% {
    transform: translateY(calc(var(--hs-size) * -0.24)) rotate(-338deg);
  }
  90% {
    transform: translate(0, 0) rotate(-360deg) scale(1.12);
  }
  96% {
    transform: translate(0, 0) rotate(-360deg) scale(1.22);
  }
  100% {
    transform: translateY(calc(var(--hs-size) * -0.24)) rotate(-360deg);
  }
}

@keyframes hs-sickle {
  0% {
    transform: translateY(calc(var(--hs-size) * 0.24)) rotate(0deg);
  }
  78% {
    transform: translateY(calc(var(--hs-size) * 0.24)) rotate(338deg);
  }
  90% {
    transform: translate(0, 0) rotate(360deg) scale(1.12);
  }
  96% {
    transform: translate(0, 0) rotate(360deg) scale(1.22);
  }
  100% {
    transform: translateY(calc(var(--hs-size) * 0.24)) rotate(360deg);
  }
}

.hs-loader__label {
  margin: 0;
  letter-spacing: 0.02em;
}

.hs-loader__bang {
  display: inline-block;
  opacity: 0;
  animation: hs-bang-text 2.6s ease-in-out infinite;
}

@keyframes hs-bang-text {
  0%,
  84%,
  100% {
    opacity: 0;
    transform: translateY(0) scale(1);
  }
  90% {
    opacity: 1;
    transform: translateY(-2px) scale(1.2);
  }
  96% {
    opacity: 0;
    transform: translateY(-4px) scale(1.35);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hs-loader__ring,
  .hs-loader__flash,
  .hs-loader__tool--hammer,
  .hs-loader__tool--sickle,
  .hs-loader__bang {
    animation: none !important;
  }

  .hs-loader__arc {
    stroke-dashoffset: 120;
  }
}
</style>
