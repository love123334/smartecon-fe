import { sanitizeDssCommentary } from '@/utils/dssCommentary'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineFormat(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/**
 * Markdown nhẹ cho nhận định DSS (##, **bold**, list) — không dùng thư viện nặng.
 */
export function formatDssMarkdown(raw: string, options?: { sanitize?: boolean }): string {
  const source = options?.sanitize === false ? raw : sanitizeDssCommentary(raw || '')
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>')
      inUl = false
    }
    if (inOl) {
      out.push('</ol>')
      inOl = false
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      closeLists()
      continue
    }

    const heading = trimmed.match(/^#{1,3}\s+(.+)$/)
    if (heading) {
      closeLists()
      out.push(`<h4 class="dss-md-h">${inlineFormat(heading[1])}</h4>`)
      continue
    }

    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (ordered) {
      if (!inOl) {
        closeLists()
        out.push('<ol class="dss-md-ol">')
        inOl = true
      }
      out.push(`<li>${inlineFormat(ordered[1])}</li>`)
      continue
    }

    const bullet = trimmed.match(/^[-*•]\s+(.+)$/)
    if (bullet) {
      if (!inUl) {
        closeLists()
        out.push('<ul class="dss-md-ul">')
        inUl = true
      }
      out.push(`<li>${inlineFormat(bullet[1])}</li>`)
      continue
    }

    closeLists()
    out.push(`<p class="dss-md-p">${inlineFormat(trimmed)}</p>`)
  }

  closeLists()
  return out.join('')
}
