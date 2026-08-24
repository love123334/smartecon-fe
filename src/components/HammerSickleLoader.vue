<script setup lang="ts">
withDefaults(
  defineProps<{
    /** xs = 20px, sm = 32px (chat/inline), md = 56px (cards), lg = 84px (page), xl = 104px (hero) */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    label?: string
    sublabel?: string
    showBang?: boolean
    variant?: 'quantum' | 'orbit' | 'minimal' | 'pulse'
  }>(),
  {
    size: 'md',
    label: 'Đang tải dữ liệu...',
    sublabel: '',
    showBang: false,
    variant: 'quantum',
  },
)
</script>

<template>
  <div
    class="quantum-loader"
    :class="[`quantum-loader--${size}`, `quantum-loader--${variant}`]"
    role="status"
    aria-live="polite"
  >
    <div class="quantum-loader__stage" aria-hidden="true">
      <!-- Glow aura background -->
      <div class="quantum-loader__aura" />

      <!-- Outer glowing orbital ring -->
      <svg class="quantum-loader__ring quantum-loader__ring--outer" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="quantum-grad-outer" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="50%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#818cf8" />
          </linearGradient>
        </defs>
        <circle class="quantum-loader__track" cx="50" cy="50" r="42" />
        <circle class="quantum-loader__arc quantum-loader__arc--outer" cx="50" cy="50" r="42" />
      </svg>

      <!-- Inner counter-spinning orbital ring -->
      <svg class="quantum-loader__ring quantum-loader__ring--inner" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="quantum-grad-inner" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#60a5fa" />
            <stop offset="70%" stop-color="#a855f7" />
            <stop offset="100%" stop-color="#38bdf8" />
          </linearGradient>
        </defs>
        <circle class="quantum-loader__arc quantum-loader__arc--inner" cx="50" cy="50" r="32" />
      </svg>

      <!-- Central energy core / particle -->
      <div class="quantum-loader__core">
        <div class="quantum-loader__core-glow" />
        <div class="quantum-loader__core-dot" />
      </div>

      <!-- Orbital satellite particles -->
      <div class="quantum-loader__satellite quantum-loader__satellite--a" />
      <div class="quantum-loader__satellite quantum-loader__satellite--b" />
    </div>

    <!-- Text labels -->
    <div v-if="label || sublabel" class="quantum-loader__text-wrap">
      <p v-if="label" class="quantum-loader__label">
        <span>{{ label.replace(/\.{2,}$/, '') }}</span>
        <span class="quantum-loader__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </p>
      <p v-if="sublabel" class="quantum-loader__sublabel">{{ sublabel }}</p>
    </div>
  </div>
</template>

<style scoped>
.quantum-loader {
  --loader-size: 56px;
  --loader-primary: #3b82f6;
  --loader-secondary: #60a5fa;
  --loader-accent: #38bdf8;
  --loader-violet: #818cf8;
  --loader-text: var(--color-text, #1e293b);
  --loader-subtext: var(--color-text-muted, #64748b);

  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  padding: 0.75rem;
  text-align: center;
  user-select: none;
}

/* Sizing presets */
.quantum-loader--xs {
  --loader-size: 20px;
  gap: 0.35rem;
  padding: 0.15rem;
}
.quantum-loader--sm {
  --loader-size: 34px;
  gap: 0.5rem;
  padding: 0.35rem;
}
.quantum-loader--md {
  --loader-size: 56px;
  gap: 0.85rem;
}
.quantum-loader--lg {
  --loader-size: 84px;
  gap: 1.15rem;
  padding: 1.25rem;
}
.quantum-loader--xl {
  --loader-size: 108px;
  gap: 1.5rem;
  padding: 1.75rem;
}

.quantum-loader__stage {
  position: relative;
  width: var(--loader-size);
  height: var(--loader-size);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Ambient glow aura */
.quantum-loader__aura {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(59, 130, 246, 0.32) 0%,
    rgba(56, 189, 248, 0.15) 50%,
    transparent 75%
  );
  filter: blur(12px);
  animation: quantum-pulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  pointer-events: none;
}

/* Rings */
.quantum-loader__ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform-origin: center center;
}

.quantum-loader__ring--outer {
  animation: quantum-spin-cw 1.1s linear infinite;
  filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.4));
}

.quantum-loader__ring--inner {
  inset: 12%;
  width: 76%;
  height: 76%;
  animation: quantum-spin-ccw 0.85s linear infinite;
  filter: drop-shadow(0 0 5px rgba(129, 140, 248, 0.35));
}

.quantum-loader__track {
  fill: none;
  stroke: rgba(59, 130, 246, 0.09);
  stroke-width: 4.5;
}

.quantum-loader__arc--outer {
  fill: none;
  stroke: url(#quantum-grad-outer);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 264;
  stroke-dashoffset: 140;
}

.quantum-loader__arc--inner {
  fill: none;
  stroke: url(#quantum-grad-inner);
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-dasharray: 200;
  stroke-dashoffset: 95;
}

/* Core pulsating dot */
.quantum-loader__core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.quantum-loader__core-glow {
  position: absolute;
  width: calc(var(--loader-size) * 0.42);
  height: calc(var(--loader-size) * 0.42);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(96, 165, 250, 0.85) 0%,
    rgba(59, 130, 246, 0.35) 45%,
    transparent 70%
  );
  animation: quantum-core-breathe 1.8s ease-in-out infinite alternate;
}

.quantum-loader__core-dot {
  width: calc(var(--loader-size) * 0.18);
  height: calc(var(--loader-size) * 0.18);
  min-width: 4px;
  min-height: 4px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffffff 0%, #93c5fd 60%, #3b82f6 100%);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.8), 0 0 20px rgba(59, 130, 246, 0.5);
  animation: quantum-core-pulse 1.4s ease-in-out infinite;
}

/* Satellites */
.quantum-loader__satellite {
  position: absolute;
  width: calc(var(--loader-size) * 0.09);
  height: calc(var(--loader-size) * 0.09);
  min-width: 3px;
  min-height: 3px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8, 0 0 14px rgba(56, 189, 248, 0.6);
  pointer-events: none;
}

.quantum-loader__satellite--a {
  top: 5%;
  left: 50%;
  margin-left: calc(var(--loader-size) * -0.045);
  animation: quantum-orbit-a 1.6s ease-in-out infinite;
}

.quantum-loader__satellite--b {
  bottom: 8%;
  right: 25%;
  background: #818cf8;
  box-shadow: 0 0 8px #818cf8;
  animation: quantum-orbit-b 2.1s ease-in-out infinite reverse;
}

/* Typography */
.quantum-loader__text-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.quantum-loader__label {
  margin: 0;
  font-family: var(--font-body, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: 0.925rem;
  font-weight: 600;
  color: var(--loader-text);
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.quantum-loader--xs .quantum-loader__label { font-size: 0.75rem; }
.quantum-loader--sm .quantum-loader__label { font-size: 0.8125rem; font-weight: 550; }
.quantum-loader--lg .quantum-loader__label { font-size: 1.05rem; font-weight: 650; }
.quantum-loader--xl .quantum-loader__label { font-size: 1.2rem; font-weight: 700; }

.quantum-loader__dots {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  margin-left: 0.2rem;
}

.quantum-loader__dots i {
  width: 0.26rem;
  height: 0.26rem;
  border-radius: 50%;
  background: var(--loader-primary);
  display: inline-block;
  opacity: 0.25;
  animation: quantum-dot-jump 1.2s ease-in-out infinite;
}

.quantum-loader__dots i:nth-child(2) {
  animation-delay: 0.2s;
  background: var(--loader-secondary);
}
.quantum-loader__dots i:nth-child(3) {
  animation-delay: 0.4s;
  background: var(--loader-accent);
}

.quantum-loader__sublabel {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 450;
  color: var(--loader-subtext);
  line-height: 1.4;
  max-width: 38ch;
}

/* Animations */
@keyframes quantum-spin-cw {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes quantum-spin-ccw {
  from {
    transform: rotate(360deg);
  }
  to {
    transform: rotate(0deg);
  }
}

@keyframes quantum-pulse {
  0%, 100% {
    transform: scale(0.9);
    opacity: 0.35;
  }
  50% {
    transform: scale(1.18);
    opacity: 0.75;
  }
}

@keyframes quantum-core-pulse {
  0%, 100% {
    transform: scale(0.92);
    box-shadow: 0 0 6px rgba(56, 189, 248, 0.7), 0 0 12px rgba(59, 130, 246, 0.4);
  }
  50% {
    transform: scale(1.15);
    box-shadow: 0 0 12px rgba(56, 189, 248, 0.95), 0 0 24px rgba(59, 130, 246, 0.7);
  }
}

@keyframes quantum-core-breathe {
  0% {
    transform: scale(0.75);
    opacity: 0.4;
  }
  100% {
    transform: scale(1.3);
    opacity: 0.85;
  }
}

@keyframes quantum-orbit-a {
  0%, 100% {
    transform: scale(0.8) translateY(0);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.25) translateY(3px);
    opacity: 1;
  }
}

@keyframes quantum-orbit-b {
  0%, 100% {
    transform: scale(0.75) translateX(0);
    opacity: 0.35;
  }
  50% {
    transform: scale(1.3) translateX(-3px);
    opacity: 1;
  }
}

@keyframes quantum-dot-jump {
  0%, 100% {
    opacity: 0.25;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

/* Reduced motion accessibility */
@media (prefers-reduced-motion: reduce) {
  .quantum-loader__ring--outer,
  .quantum-loader__ring--inner,
  .quantum-loader__aura,
  .quantum-loader__core-glow,
  .quantum-loader__core-dot,
  .quantum-loader__satellite,
  .quantum-loader__dots i {
    animation: none !important;
  }
  .quantum-loader__arc--outer {
    stroke-dashoffset: 60;
  }
  .quantum-loader__arc--inner {
    stroke-dashoffset: 40;
  }
}
</style>
