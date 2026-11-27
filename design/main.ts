import { getSku } from './catalog/products'
import { renderCatalog, renderProduct, updateSearch } from './screens/catalog'
import { renderCart, renderFavorites } from './screens/lists'
import { createSession } from './shop-session'

type View = { key: string; query: string; top: number; product?: string }

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

function remember() {
  view.top = page.scrollTop
  if (groups.has(view.key)) {
    lastCatalog = { ...view }
    catalogViews.set(view.key, lastCatalog)
  }
}

function display() {
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
    renderCatalog(page, groups.get(view.key)!, view.query)
    if (view.product) {
      page.querySelector<HTMLElement>(`[data-product="${CSS.escape(view.product)}"]`)?.focus({ preventScroll: true })
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

shell.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('button') : null
  if (!button) return
  const { route, product, variant, removeFavorite, addSku, quantityChange } = button.dataset

  if (route) {
    if (route === view.key || (button.matches('.tab') && route === 'catalog' && groups.has(view.key))) return
    if (route === 'catalog' && !groups.has(view.key)) return navigate({ ...lastCatalog })
    const target = freshView(route)
    if (groups.has(route) && groups.has(view.key)) {
      target.query = view.query
      const previous = catalogViews.get(route)
      const header = page.querySelector<HTMLElement>('.catalog-header')!
      target.top = previous?.query === view.query ? previous.top : Math.min(page.scrollTop, header.offsetHeight)
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
  if (variant) return navigate(freshView(variant), true)
  if (button.matches('.catalog-search-clear')) {
    search('')
    page.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    return
  }

  const sku = getSku(view.key)
  if (sku && button.hasAttribute('data-buy')) {
    session.changeQuantity(sku.variant.id, 1)
    return navigate(freshView('cart'))
  }
  if (sku && button.hasAttribute('data-save')) {
    session.toggleFavorite(sku.product.id)
    if (session.favorites.has(sku.product.id)) return navigate(freshView('favorites'))
  } else if (removeFavorite) {
    session.toggleFavorite(removeFavorite)
  } else if (addSku) {
    session.changeQuantity(addSku, 1)
  } else if (quantityChange) {
    const id = button.closest<HTMLElement>('[data-sku]')!.dataset.sku!
    session.changeQuantity(id, Number(quantityChange))
  } else {
    return
  }

  const rowId = button.closest<HTMLElement>('[data-sku]')?.dataset.sku
  remember()
  display()
  if (rowId && quantityChange) {
    page.querySelector<HTMLElement>(`[data-sku="${CSS.escape(rowId)}"] [data-quantity-change="${quantityChange}"]`)?.focus({ preventScroll: true })
  }
})

window.addEventListener('popstate', event => {
  remember()
  index = Number.isInteger(event.state?.shopIndex) ? event.state.shopIndex : 0
  const target = viewFromUrl()
  const saved = views.get(index)
  view = saved?.key === target.key ? saved : target
  views.set(index, view)
  displayNewPage()
})

function fitDemo() {
  const scale = Math.min(1, document.body.clientWidth / shell.offsetWidth, document.body.clientHeight / shell.offsetHeight)
  shell.style.setProperty('--scale', String(scale))
}
new ResizeObserver(fitDemo).observe(document.body)
fitDemo()
display()
