export function matchesPriceRange(price: number, range: string): boolean {
  if (!range) return true
  const [minStr, maxStr] = range.split('-')
  const min = Number(minStr) || 0
  if (maxStr === undefined || maxStr === '') return price >= min
  const max = Number(maxStr)
  return price >= min && price <= max
}
