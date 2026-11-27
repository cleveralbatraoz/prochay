import { formatPackSize, unitKind } from '../catalog/pack-size'
import { getProduct, getSku, imageUrl, rubles, variantsOf, type Product } from '../catalog/products'
import { cartSummary, type Session } from '../shop-session'
import cartMarkup from './cart.html?raw'
import favoritesMarkup from './favorites.html?raw'
import { element, templates } from './template'

const cartTemplate = templates(cartMarkup)
const favoritesTemplate = templates(favoritesMarkup)
const plurals = new Intl.PluralRules('ru')
const countWords: Record<string, string> = { one: 'товар', few: 'товара' }
const listFormat = new Intl.ListFormat('ru', { type: 'disjunction' })

export function renderCart(page: HTMLElement, session: Session) {
  const { lines, total } = cartSummary(session.quantities, getSku)
  if (lines.length === 0) {
    page.replaceChildren(cartTemplate('empty-cart'))
    return
  }

  const content = cartTemplate('cart')
  const footer = element(content, '.end-actions')
  for (const { product, variant, quantity, amount } of lines) {
    const row = cartTemplate('cart-row')
    element(row, '.cart-row').dataset.sku = variant.id
    element<HTMLImageElement>(row, 'img').src = imageUrl(product, variant.id === product.id)
    element(row, 'h2').textContent = product.name
    const sizeLabel = formatPackSize(variant.size)
    element(row, 'p').textContent = product.category + ' · ' + sizeLabel
    const label = product.name + ', ' + sizeLabel
    element(row, '.stepper').setAttribute('aria-label', 'Количество: ' + label)
    element(row, '[data-quantity-change="-1"]').setAttribute('aria-label', 'Уменьшить количество: ' + label)
    element(row, '[data-quantity-change="1"]').setAttribute('aria-label', 'Увеличить количество: ' + label)
    element(row, '.stepper > span').textContent = String(quantity)
    element(row, '.price').textContent = rubles(amount)
    footer.before(row)
  }
  for (const product of new Set(lines.map(line => line.product))) {
    for (const variant of variantsOf(product)) {
      if (session.quantities.has(variant.id)) continue
      const shortcut = cartTemplate('add-pack')
      element(shortcut, '.add-pack').dataset.addSku = variant.id
      element(shortcut, '.pack-label').textContent = 'Добавить ' + formatPackSize(variant.size)
      element(shortcut, '.price').textContent = rubles(variant.price)
      footer.before(shortcut)
    }
  }
  element(footer, '.summary strong').textContent = rubles(total)
  page.replaceChildren(content)
}

function favoriteCard(product: Product) {
  const card = favoritesTemplate('favorite')
  const photoLink = element(card, '.hero-link')
  photoLink.dataset.product = product.id
  photoLink.setAttribute('aria-label', 'Открыть ' + product.name)
  const image = element<HTMLImageElement>(photoLink, 'img')
  image.src = imageUrl(product)
  image.alt = product.name
  if (product.id === 'tea') {
    const wrapper = document.createElement('span')
    wrapper.className = 'hero-photo'
    image.className = 'hero-pack'
    wrapper.append(image)
    photoLink.append(wrapper)
  } else if (!product.origin) {
    image.classList.add('object-saved-photo')
  }
  const remove = element(card, '.save-button')
  remove.dataset.removeFavorite = product.id
  remove.setAttribute('aria-label', 'Убрать ' + product.name + ' из избранного')
  element(card, '.saved-title').textContent = product.name
  element(card, '.meta').textContent = [product.category, product.region ?? product.origin].filter(Boolean).join(' · ')
  const packs = variantsOf(product)
  const sizes = packs.map(pack => pack.size).filter(size => unitKind(size.unit) !== 'count')
  const unitLabel = element(card, '.row-meta')
  if (sizes.length === 0) {
    unitLabel.remove()
  } else {
    const sameUnit = sizes.every(size => size.unit === sizes[0].unit)
    const labels = sizes.map((size, index) =>
      sameUnit && index < sizes.length - 1 ? size.amount.toLocaleString('ru-RU') : formatPackSize(size)
    )
    unitLabel.textContent = listFormat.format(labels)
  }
  const minimum = Math.min(...packs.map(pack => pack.price))
  element(card, '.price').textContent = (packs.length > 1 ? 'от ' : '') + rubles(minimum)
  element(card, '.buy').dataset.product = product.id
  element(card, '.action-label').textContent = packs.length > 1 ? 'Выбрать фасовку' : 'Открыть карточку'
  return card
}

export function renderFavorites(page: HTMLElement, session: Session) {
  const count = session.favorites.size
  if (count === 0) {
    page.replaceChildren(favoritesTemplate('empty-favorites'))
    return
  }
  const content = favoritesTemplate('favorites')
  element(content, '.sub').textContent = count + ' ' + (countWords[plurals.select(count)] ?? 'товаров')
  for (const id of session.favorites) {
    const product = getProduct(id)
    if (!product) throw new Error('В каталоге отсутствует товар ' + id)
    content.append(favoriteCard(product))
  }
  page.replaceChildren(content)
}
