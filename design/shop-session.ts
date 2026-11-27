import type { Product, Variant } from './catalog/products'

export function createSession() {
  const favorites = new Set<string>()
  const quantities = new Map<string, number>()

  function toggleFavorite(productId: string) {
    if (favorites.has(productId)) favorites.delete(productId)
    else favorites.add(productId)
  }

  function changeQuantity(variantId: string, delta: number) {
    const quantity = (quantities.get(variantId) ?? 0) + delta
    if (quantity > 0) quantities.set(variantId, quantity)
    else quantities.delete(variantId)
  }

  return { favorites, quantities, toggleFavorite, changeQuantity }
}

export type Session = ReturnType<typeof createSession>

type Sku = { product: Product; variant: Variant }
type CartLine = Sku & { quantity: number; amount: number }

export function cartSummary(quantities: ReadonlyMap<string, number>, getSku: (id: string) => Sku | undefined) {
  const lines: CartLine[] = []
  let totalKopecks = 0
  for (const [id, quantity] of quantities) {
    const sku = getSku(id)
    if (!sku) throw new Error('Неизвестная позиция корзины: ' + id)
    const kopecks = Math.round(sku.variant.price * 100) * quantity
    lines.push({ ...sku, quantity, amount: kopecks / 100 })
    totalKopecks += kopecks
  }
  return { lines, total: totalKopecks / 100 }
}
