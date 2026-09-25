export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`
  }
  return digits
}

export function formatPhone(phone) {
  const d = String(phone || '')
  if (d.length === 11 && d.startsWith('7')) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`
  }
  if (d.length === 12 && d.startsWith('375')) {
    return `+375 ${d.slice(3, 5)} ${d.slice(5, 8)}-${d.slice(8, 10)}-${d.slice(10)}`
  }
  return d ? `+${d}` : ''
}
