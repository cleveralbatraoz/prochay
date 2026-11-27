import { formatPackSize, unitKind } from '../catalog/pack-size'
import { getProduct, imageUrl, products, rubles, variantsOf, type Product, type Variant } from '../catalog/products'
import catalogMarkup from './catalog.html?raw'
import productMarkup from './product.html?raw'
import { element, templates } from './template'

const catalogTemplate = templates(catalogMarkup)
const productTemplate = templates(productMarkup)
const plurals = new Intl.PluralRules('ru')

function normalize(text: string) {
  return text.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е')
}

export function updateSearch(page: HTMLElement, query: string) {
  const input = element<HTMLInputElement>(page, '.catalog-search-input')
  if (input.value !== query) input.value = query
  const words = normalize(query).split(/\s+/).filter(Boolean)
  let count = 0
  for (const tile of page.querySelectorAll<HTMLElement>('[data-product]')) {
    const name = normalize(getProduct(tile.dataset.product!)!.name)
    const matches = words.every(word => name.includes(word))
    const card = tile.closest<HTMLElement>('.catalog-feature') ?? tile
    card.hidden = !matches
    if (matches) count++
  }
  element(page, '.catalog-search-clear').hidden = !query
  element(page, '.catalog-no-results').hidden = count !== 0
  const form = plurals.select(count)
  element(page, '.catalog-count').textContent = count + ' ' + (form === 'one' ? 'товар' : form === 'few' ? 'товара' : 'товаров')
}

function productTile(product: Product, featured: boolean) {
  const tile = catalogTemplate(featured ? 'featured' : 'tile')
  element(tile, 'button').dataset.product = product.id
  element<HTMLImageElement>(tile, 'img').src = imageUrl(product)
  element(tile, 'strong').textContent = product.name
  element(tile, '.meta').textContent = featured ? [product.category, product.region].filter(Boolean).join(' · ') : product.category
  const price = element(tile, '.price')
  const kind = unitKind(product.size.unit)
  const amount = (featured ? 'от ' : '') + rubles(product.price)
  if (kind === 'count') {
    price.textContent = amount
  } else {
    price.prepend(amount + ' ')
    element(price, 'small').textContent = (kind === 'weight' ? '/ ' : '· ') + formatPackSize(product.size)
  }
  return tile
}

export function renderCatalog(page: HTMLElement, group: string, query: string) {
  const screen = catalogTemplate('catalog')
  const route = group === 'all' ? 'catalog' : 'catalog-' + group
  const activeTab = element(screen, `[data-route="${CSS.escape(route)}"]`)
  activeTab.setAttribute('aria-current', 'true')
  element(screen, 'h1').textContent = group === 'all' ? 'Каталог' : activeTab.textContent
  const grid = element(screen, '.catalog-grid')
  for (const product of products) {
    if (group !== 'all' && group !== product.group) continue
    const featured = group === 'all' && product.id === 'tea'
    const tile = productTile(product, featured)
    if (featured) grid.before(tile)
    else grid.append(tile)
  }
  page.replaceChildren(screen)
  updateSearch(page, query)
}

function unitLabel({ size, group }: Product) {
  if (unitKind(size.unit) === 'volume') return 'Объём'
  if (group === 'tea') return 'Фасовка'
  if (size.unit === 'piece' && size.amount > 1) return 'В упаковке'
  return 'Количество'
}

function packaging(product: Product, selected: Variant) {
  const variants = variantsOf(product)
  if (!product.packLabel && variants.length === 1) {
    const row = productTemplate('unit')
    element(row, 'span').textContent = unitLabel(product)
    element(row, 'strong').textContent = formatPackSize(selected.size)
    return row
  }
  const packs = productTemplate('packs')
  const options = element(packs, '.pack-options')
  for (const choice of variants) {
    const isSelected = choice.id === selected.id
    const sizeLabel = formatPackSize(choice.size)
    const option = document.createElement(isSelected ? 'div' : 'button')
    option.className = 'pack'
    if (isSelected) {
      option.dataset.selected = 'true'
      option.setAttribute('aria-label', [sizeLabel, choice.packLabel, 'выбрано'].filter(Boolean).join(', '))
    } else {
      option.setAttribute('type', 'button')
      option.dataset.variant = choice.id
    }
    const label = productTemplate('pack-label')
    element(label, 'strong').textContent = sizeLabel
    element(label, 'small').textContent = choice.packLabel ?? ''
    const price = element(label, '.price')
    if (variants.length > 1) price.textContent = rubles(choice.price)
    else price.remove()
    option.append(label)
    options.append(option)
  }
  return packs
}

export function renderProduct(page: HTMLElement, product: Product, variant: Variant, saved: boolean) {
  const screen = productTemplate('product')
  const save = element(screen, '.save-button')
  save.setAttribute('aria-pressed', String(saved))
  save.setAttribute('aria-label', saved ? 'Убрать из избранного' : 'Добавить в избранное')
  element<SVGElement>(save, 'svg').setAttribute('fill', saved ? 'currentColor' : 'none')

  const photo = element(screen, '.detail-photo')
  const image = element<HTMLImageElement>(photo, 'img')
  image.src = imageUrl(product, true)
  image.alt = product.name
  const title = element(screen, 'h1')
  title.textContent = product.name
  if (product.packLabel) {
    photo.classList.add('detail-' + product.id)
  } else {
    photo.classList.add('object-photo')
    title.classList.add('object-title')
  }
  element(screen, '.meta').textContent = [product.category, product.origin, product.region].filter(Boolean).join(' · ')
  element(screen, '.taste').textContent = product.description
  element(screen, '.buy .price').textContent = rubles(variant.price)
  element(screen, '.end-actions').before(packaging(product, variant))
  page.replaceChildren(screen)
}
