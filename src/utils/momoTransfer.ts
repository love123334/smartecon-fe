/** MoMo transfer deeplink (mobile) — opens MoMo app when installed. */
export function momoTransferDeeplink(
  phone: string,
  amount: number,
  note: string,
): string {
  const digits = phone.replace(/\D/g, '')
  const params = new URLSearchParams()
  if (amount > 0) params.set('amount', String(Math.round(amount)))
  if (note.trim()) params.set('comment', note.trim())
  const qs = params.toString()
  return qs
    ? `https://nhantien.momo.vn/${digits}?${qs}`
    : `https://nhantien.momo.vn/${digits}`
}

export async function copyTransferText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Fallback QR when seller upload URL is missing or 404 (Railway /uploads ephemeral). */
export function momoTransferQrImageUrl(deeplink: string, size = 240): string {
  const data = encodeURIComponent(deeplink)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}&margin=0`
}
