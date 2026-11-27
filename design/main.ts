import { getSku } from './catalog/products'
import { renderCatalog, renderProduct, updateSearch } from './screens/catalog'
import { renderCart, renderFavorites } from './screens/lists'
import { createSession } from './shop-session'

type CatalogAnchor = { product: string; width: number; height: number }
type View = { key: string; query: string; top: number; product?: string; anchor?: CatalogAnchor }

const groups = new Map([
  ['catalog', 'all'], ['catalog-tea', 'tea'], ['catalog-ware', 'ware'], ['catalog-accessories', 'accessories'],
])
const shell = document.querySelector<HTMLElement>('.tea-shell')!
const topbar = shell.querySelector<HTMLElement>('.topbar')!
const brand = topbar.querySelector<HTMLElement>('.brand')!
let page = shell.querySelector<HTMLElement>('.page')!
const tabs = shell.querySelectorAll<HTMLButtonElement>('.bottom-nav button')
const session = createSession()

function freshView(key = 'catalog'): View {
  return { key, query: '', top: 0 }
}

function viewFromUrl() {
  const key = new URLSearchParams(location.search).get('frame') ?? 'catalog'
  if (groups.has(key) || key === 'favorites' || key === 'cart' || getSku(key)) return freshView(key)
  return freshView()
}

let view = viewFromUrl()
let index = 0
let lastCatalog = freshView()
const catalogViews = new Map<string, View>()
const views = new Map([[index, view]])
history.replaceState({ shopIndex: index }, '')

function catalogCard(id: string) {
  return page.querySelector<HTMLButtonElement>(`[data-product="${CSS.escape(id)}"]`)
}

function visibleCatalogAnchor() {
  if (!view.top && !view.product) return
  const top = page.querySelector<HTMLElement>('.catalog-tabs')!.getBoundingClientRect().bottom
  const bottom = page.getBoundingClientRect().bottom
  const isVisible = (card: HTMLElement) => {
    const rect = card.getBoundingClientRect()
    return rect.height > 0 && rect.bottom > top && rect.top < bottom
  }
  const selected = view.product && catalogCard(view.product)
  const card = selected && isVisible(selected) ? selected :
    Array.from(page.querySelectorAll<HTMLButtonElement>('[data-product]')).find(isVisible)
  if (card) return { product: card.dataset.product!, width: page.clientWidth, height: page.clientHeight }
}

function restoreCatalogAnchor(anchor: CatalogAnchor) {
  if (anchor.width === page.clientWidth && anchor.height === page.clientHeight) return
  const card = catalogCard(anchor.product)
  if (!card) return
  const rect = card.getBoundingClientRect()
  const top = page.querySelector<HTMLElement>('.catalog-tabs')!.getBoundingClientRect().bottom
  const bottom = page.getBoundingClientRect().bottom
  const height = bottom - top
  const target = rect.height > height ? card.querySelector('.product-name, .hero-name')!.getBoundingClientRect() : rect
  if (target.top < top || target.bottom > bottom) {
    page.scrollTop += target.top - top - Math.max(0, (height - target.height) / 2)
  }
}

function remember() {
  view.top = page.scrollTop
  if (groups.has(view.key)) {
    view.anchor = visibleCatalogAnchor()
    lastCatalog = { ...view }
    catalogViews.set(view.key, lastCatalog)
  }
}

let catalogPhotos: IntersectionObserver | undefined

function display() {
  catalogPhotos?.disconnect()
  catalogPhotos = undefined
  const sku = getSku(view.key)
  let tab = 'catalog'
  if (sku) {
    renderProduct(page, sku.product, sku.variant, session.favorites.has(sku.product.id))
  } else if (view.key === 'favorites') {
    tab = 'favorites'
    renderFavorites(page, session)
  } else if (view.key === 'cart') {
    tab = 'cart'
    renderCart(page, session)
  } else {
    catalogPhotos = renderCatalog(page, groups.get(view.key)!, view.query)
    if (view.product) {
      catalogCard(view.product)?.focus({ preventScroll: true })
    }
  }
  const brandHeader = page.querySelector('header.catalog-header') ?? topbar
  brandHeader.prepend(brand)
  topbar.hidden = brandHeader !== topbar
  for (const button of tabs) {
    if (button.dataset.route === tab) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  }
  document.title = (page.querySelector('h1')?.textContent ?? 'Каталог') + ' · ПРОЧАЙ'
  page.scrollTop = view.top
  if (view.anchor) restoreCatalogAnchor(view.anchor)
}

function displayNewPage() {
  const nextPage = page.cloneNode(false) as HTMLElement
  page.replaceWith(nextPage)
  page = nextPage
  display()
}

function navigate(target: View, replace = false) {
  remember()
  if (!replace) index++
  view = target
  views.set(index, view)
  const url = new URL(location.href)
  url.searchParams.set('frame', view.key)
  if (replace) history.replaceState({ shopIndex: index }, '', url)
  else history.pushState({ shopIndex: index }, '', url)
  displayNewPage()
}

function search(text: string) {
  view.query = text
  view.product = undefined
  updateSearch(page, text)
  page.scrollTop = 0
}

shell.addEventListener('input', event => {
  if (event.target instanceof HTMLInputElement && event.target.type === 'search') search(event.target.value)
})

let displacedPointer: { button: HTMLButtonElement; x: number; y: number; time: number; type: string } | undefined

function rememberDisplacedPointer(event: PointerEvent) {
  if (event.detail === 0) return
  const { clientX: x, clientY: y, timeStamp: time, pointerType: type } = event
  queueMicrotask(() => {
    const button = document.elementFromPoint(x, y)?.closest('button')
    if (button) displacedPointer = { button, x, y, time, type }
  })
}

shell.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('button') : null
  if (!button) return
  if (displacedPointer?.button === button && event.detail > 0 && event.pointerType === displacedPointer.type &&
      event.timeStamp - displacedPointer.time < 500 &&
      Math.hypot(event.clientX - displacedPointer.x, event.clientY - displacedPointer.y) <= 10) return
  displacedPointer = undefined
  const { route, product, variant, removeFavorite, addSku, quantityChange } = button.dataset

  if (route) {
    if (route === view.key || (button.matches('.tab') && route === 'catalog' && groups.has(view.key))) return
    if (route === 'catalog' && !groups.has(view.key)) return navigate({ ...lastCatalog })
    const target = freshView(route)
    if (groups.has(route) && groups.has(view.key)) {
      target.query = view.query
      const previous = catalogViews.get(route)
      const header = page.querySelector<HTMLElement>('.catalog-header')!
      if (previous?.query === view.query) {
        target.top = previous.top
        target.anchor = previous.anchor
      } else {
        target.top = Math.min(page.scrollTop, header.offsetHeight)
      }
      navigate(target)
      page.querySelector<HTMLButtonElement>('.catalog-tabs [aria-current]')!.focus({ preventScroll: true })
      return
    }
    return navigate(target)
  }
  if (button.hasAttribute('data-back')) {
    if (index > 0) history.back()
    else navigate({ ...lastCatalog }, true)
    return
  }
  if (product) {
    view.product = product
    return navigate(freshView(product))
  }
  if (variant) {
    navigate(freshView(variant), true)
    page.querySelector<HTMLButtonElement>('.pack[aria-pressed="true"]')?.focus()
    return
  }
  if (button.matches('.catalog-search-clear')) {
    search('')
    page.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    return
  }

  const sku = getSku(view.key)
  if (sku && button.hasAttribute('data-buy')) {
    rememberDisplacedPointer(event)
    session.changeQuantity(sku.variant.id, 1)
    return navigate(freshView('cart'))
  }
  if (sku && button.hasAttribute('data-save')) {
    session.toggleFavorite(sku.product.id)
    if (session.favorites.has(sku.product.id)) return navigate(freshView('favorites'))
  } else if (removeFavorite) {
    rememberDisplacedPointer(event)
    session.toggleFavorite(removeFavorite)
  } else if (addSku) {
    session.changeQuantity(addSku, 1)
  } else if (quantityChange) {
    const id = button.closest<HTMLElement>('[data-sku]')!.dataset.sku!
    session.changeQuantity(id, Number(quantityChange))
    if (!session.quantities.has(id)) rememberDisplacedPointer(event)
  } else {
    return
  }

  const controlSelector = quantityChange ? `[data-quantity-change="${quantityChange}"]` : '[data-remove-favorite]'
  const controlIndex = Array.from(page.querySelectorAll(controlSelector)).indexOf(button)
  remember()
  display()
  if (controlIndex !== -1) {
    const controls = page.querySelectorAll<HTMLButtonElement>(controlSelector)
    const next = controls[Math.min(controlIndex, controls.length - 1)] ?? page.querySelector<HTMLButtonElement>('.end-actions button')
    next?.focus({ preventScroll: true })
  }
})

window.addEventListener('popstate', event => {
  displacedPointer = undefined
  remember()
  index = Number.isInteger(event.state?.shopIndex) ? event.state.shopIndex : 0
  const target = viewFromUrl()
  const saved = views.get(index)
  view = saved?.key === target.key ? saved : target
  views.set(index, view)
  displayNewPage()
})

display()
