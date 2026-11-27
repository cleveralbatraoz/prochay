type Variant = { id: string; unit: string; price: number }
export type Product = Variant & { name: string; variants?: readonly Variant[] }
type Sku = { product: Product; variant: Variant; basket: string }

const customScreens: Record<string, { basket: string; favorites: string }> = {
  tea: { basket: 'cart', favorites: 'favorites' },
  'tea-brick': { basket: 'cart-brick', favorites: 'favorites' },
  jasmine: { basket: 'cart-jasmine', favorites: 'favorites-jasmine' },
  hibiscus: { basket: 'cart-hibiscus', favorites: 'favorites-hibiscus' },
}
const prices = new Intl.NumberFormat('ru-RU')
const plurals = new Intl.PluralRules('ru')
const productCountForms: Record<string, string> = { one: 'товар', few: 'товара' }

function rubles(amount: number) {
  return prices.format(amount).replaceAll('\u00a0', '\u202f') + '\u00a0₽'
}

function element(root: ParentNode, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector)
  if (!found) throw new Error(`В макете отсутствует элемент ${selector}`)
  return found
}

function copy(root: ParentNode, selector: string) {
  return element(root, selector).cloneNode(true) as HTMLElement
}

function isBasket(key: string) {
  return key === 'cart' || key.startsWith('cart-') || key.startsWith('bag-') || key.startsWith('pair-')
}

function isFavorites(key: string) {
  return key === 'favorites' || key.startsWith('favorites-') || key.startsWith('saved-')
}

export function createShopSession(products: readonly Product[], contentFor: (key: string) => ParentNode) {
  const skus = new Map<string, Sku>()
  const saved = new Map<string, Product>()
  const quantities = new Map<string, number>()

  for (const product of products) {
    for (const variant of [product, ...product.variants ?? []]) {
      const custom = customScreens[variant.id]
      const detail = custom ? variant.id : 'item-' + variant.id
      skus.set(detail, { product, variant, basket: custom?.basket ?? 'bag-' + variant.id })
    }
  }

  function changeQuantity(detail: string, by: number) {
    const quantity = (quantities.get(detail) ?? 0) + by
    if (quantity > 0) quantities.set(detail, quantity)
    else quantities.delete(detail)
  }

  function templateKey(key: string) {
    if (isBasket(key)) return quantities.size ? 'cart' : 'cart-empty'
    if (isFavorites(key)) return saved.size ? 'favorites' : 'favorites-empty'
    return key
  }

  function renderBasket(root: ParentNode) {
    const basket = element(root, '.cart-content')
    const footer = element(basket, '.end-actions')
    const rows: HTMLElement[] = []
    let total = 0
    for (const [detail, quantity] of quantities) {
      const { product, variant, basket: screen } = skus.get(detail)!
      const row = copy(contentFor(screen), '.cart-row')
      const amount = quantity * variant.price
      row.dataset.sku = detail
      element(row, '.price').textContent = rubles(amount)
      element(row, '.stepper > span').textContent = String(quantity)
      const decrease = element(row, '.stepper button:first-of-type')
      const increase = element(row, '.stepper button:last-of-type')
      decrease.dataset.quantityChange = '-1'
      increase.dataset.quantityChange = '1'
      decrease.setAttribute('aria-label', `Уменьшить количество: ${product.name}, ${variant.unit}`)
      increase.setAttribute('aria-label', `Увеличить количество: ${product.name}, ${variant.unit}`)
      rows.push(row)
      total += amount
    }
    if (quantities.has('tea') !== quantities.has('tea-brick')) {
      const current = quantities.has('tea') ? 'tea' : 'tea-brick'
      const shortcut = copy(contentFor(skus.get(current)!.basket), '.add-pack')
      shortcut.dataset.addSku = current === 'tea' ? 'tea-brick' : 'tea'
      rows.push(shortcut)
    }
    element(footer, '.summary strong').textContent = rubles(total)
    basket.replaceChildren(element(basket, '.heading'), ...rows, footer)
  }

  function renderFavorites(root: ParentNode) {
    const page = element(root, '.page')
    const heading = element(page, '.heading')
    element(heading, '.sub').textContent = `${saved.size} ${productCountForms[plurals.select(saved.size)] ?? 'товаров'}`
    page.replaceChildren(heading)
    for (const product of saved.values()) {
      const template = contentFor(customScreens[product.id]?.favorites ?? 'saved-' + product.id)
      const photo = copy(template, '.saved-feature')
      const remove = element(photo, '.save-button')
      remove.dataset.removeFavorite = product.id
      remove.setAttribute('aria-label', `Убрать ${product.name} из избранного`)
      page.append(photo, copy(template, '.saved-caption'), copy(template, '.end-actions'))
    }
  }

  function render(key: string, root: ParentNode) {
    if (isBasket(key) && quantities.size) renderBasket(root)
    if (isFavorites(key) && saved.size) renderFavorites(root)
    const sku = skus.get(key)
    if (sku) {
      const button = element(root, '.detail-bar .save-button')
      const selected = saved.has(sku.product.id)
      button.setAttribute('aria-pressed', String(selected))
      button.setAttribute('aria-label', selected ? 'Убрать из избранного' : 'Добавить в избранное')
      element(button, 'svg').setAttribute('fill', selected ? 'currentColor' : 'none')
    }
  }

  function activate(key: string, button: HTMLElement) {
    const sku = skus.get(key)
    if (sku && button.matches('.detail-bar .save-button')) {
      if (saved.delete(sku.product.id)) return key
      saved.set(sku.product.id, sku.product)
      return 'favorites'
    }
    if (sku && button.matches('.end-actions .buy')) {
      changeQuantity(key, 1)
      return 'cart'
    }
    if (button.dataset.removeFavorite) {
      saved.delete(button.dataset.removeFavorite)
      return key
    }
    const detail = button.closest<HTMLElement>('[data-sku]')?.dataset.sku
    if (detail && button.dataset.quantityChange) {
      changeQuantity(detail, Number(button.dataset.quantityChange))
      return key
    }
    if (button.dataset.addSku) {
      changeQuantity(button.dataset.addSku, 1)
      return key
    }
  }

  return { templateKey, render, activate }
}
