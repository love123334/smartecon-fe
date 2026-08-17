<template>
  <div class="auth-hero" aria-hidden="true">
    <svg viewBox="0 0 420 320" class="auth-hero__svg" role="presentation">
      <defs>
        <linearGradient id="authHeroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0.25" />
        </linearGradient>
      </defs>
      <rect x="24" y="40" width="372" height="240" rx="20" fill="url(#authHeroGrad)" />
      <rect x="48" y="72" width="140" height="96" rx="12" fill="#fff" fill-opacity="0.12" />
      <rect x="204" y="72" width="168" height="40" rx="8" fill="#fff" fill-opacity="0.18" />
      <rect x="204" y="128" width="120" height="40" rx="8" fill="#fff" fill-opacity="0.12" />
      <circle cx="118" cy="120" r="28" fill="#5eead4" fill-opacity="0.35" />
      <path
        d="M248 200 L280 168 L312 184 L348 148 L372 172"
        stroke="#99f6e4"
        stroke-width="4"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <rect x="48" y="196" width="88" height="56" rx="10" fill="#fff" fill-opacity="0.1" />
      <rect x="152" y="196" width="88" height="56" rx="10" fill="#fff" fill-opacity="0.1" />
      <rect x="256" y="196" width="116" height="56" rx="10" fill="#fff" fill-opacity="0.16" />
      <circle cx="332" cy="88" r="18" fill="#fbbf24" fill-opacity="0.45" />
    </svg>
    <p class="auth-hero__caption">Mua sắm thông minh · Gợi ý AI · Quản lý bán hàng</p>
  </div>
</template>

<style scoped>
.auth-hero {
  margin-top: 2rem;
  max-width: 420px;
}

.auth-hero__svg {
  width: 100%;
  height: auto;
  display: block;
  opacity: 0.95;
}

.auth-hero__caption {
  margin: 0.85rem 0 0;
  font-size: 0.8125rem;
  opacity: 0.75;
  letter-spacing: 0.02em;
}
</style>
