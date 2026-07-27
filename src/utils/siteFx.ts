const RICK = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const SHAKE_SONG = 'https://www.youtube.com/watch?v=nfWlot6h_JM'

let styleReady = false

function ensureStyles() {
  if (styleReady || typeof document === 'undefined') return
  styleReady = true
  const style = document.createElement('style')
  style.setAttribute('data-site-fx', '1')
  style.textContent = `
html.site-flip {
  transform: rotate(180deg);
  transform-origin: center center;
  transition: transform 0.45s ease;
}
html.site-shake {
  animation: site-shake-kf 0.45s ease-in-out infinite;
}
@keyframes site-shake-kf {
  0%, 100% { transform: translate(0, 0) rotate(var(--site-flip-rot, 0deg)); }
  20% { transform: translate(-10px, 4px) rotate(var(--site-flip-rot, 0deg)); }
  40% { transform: translate(10px, -4px) rotate(var(--site-flip-rot, 0deg)); }
  60% { transform: translate(-8px, -2px) rotate(var(--site-flip-rot, 0deg)); }
  80% { transform: translate(8px, 3px) rotate(var(--site-flip-rot, 0deg)); }
}
html.site-flip.site-shake {
  --site-flip-rot: 180deg;
}
`
  document.head.appendChild(style)
}

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '')
}

/** Returns true if the input was consumed (caller should skip normal flow). */
export function trySiteFx(raw: string): boolean {
  const code = normalize(raw)
  if (!code) return false
  ensureStyles()
  const root = document.documentElement

  if (code === 'rollit') {
    window.location.href = RICK
    return true
  }

  if (code === 'flipit') {
    root.classList.toggle('site-flip')
    return true
  }

  if (code === 'shakeitoff') {
    root.classList.add('site-shake')
    window.setTimeout(() => {
      root.classList.remove('site-shake')
      window.location.href = SHAKE_SONG
    }, 2200)
    return true
  }

  return false
}
