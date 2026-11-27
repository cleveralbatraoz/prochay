import { composeFrameHtml, type FrameResources } from 'doop/shared/frameCompose.ts'
import { filterCatalog } from './catalog-search'
import { createShopSession, type Product } from './shop-state'
import './styles.css'

type Frame = { id: string; key: string; html: string; width: number; height: number }
type Canvas = {
  id: string
  pages: { startFrameId: string }[]
  frames: Frame[]
  products: Product[]
  components: FrameResources['components']
  tokens: FrameResources['tokens']
  tokenThemes: string[]
}
type View = { key: string; query: string; top: number; product?: string }

const stage = document.querySelector<HTMLElement>('#root')!
const iframe = stage.querySelector('iframe')!

function isCatalog(key: string) {
  return key === 'catalog' || key.startsWith('catalog-')
}

function startShop(canvas: Canvas) {
  const byId = new Map(canvas.frames.map(frame => [frame.id, frame]))
  const byKey = new Map(canvas.frames.map(frame => [frame.key, frame]))
  const names = new Map(canvas.products.map(product => [product.id, product.name]))
  const documents = new Map<string, Document>()
  function contentFor(key: string) {
    let doc = documents.get(key)
    if (!doc) {
      const frame = byKey.get(key)
      if (!frame) throw new Error('Отсутствует экран ' + key)
      const html = composeFrameHtml(frame.html, {
        components: canvas.components, tokens: canvas.tokens, themes: canvas.tokenThemes,
      })
      doc = new DOMParser().parseFromString(html, 'text/html')
      documents.set(key, doc)
    }
    return doc
  }

  const doc = iframe.contentDocument!
  doc.documentElement.lang = 'ru'
  const shop = createShopSession(canvas.products, contentFor)
  const initial = byId.get(canvas.pages[0].startFrameId)!
  function resize() {
    const scale = Math.min(1, stage.clientWidth / initial.width, stage.clientHeight / initial.height)
    iframe.style.setProperty('--scale', String(scale))
  }
  iframe.width = String(initial.width)
  iframe.height = String(initial.height)
  new ResizeObserver(resize).observe(stage)
  resize()

  const views = new Map<number, View>()
  let index = 0
  let view = viewFromUrl()
  let lastCatalog: View = { key: initial.key, query: '', top: 0 }
  let page: HTMLElement
  function viewFromUrl(): View {
    const requested = new URLSearchParams(location.search).get('frame') ?? ''
    const frame = byKey.get(requested) ?? initial
    return { key: frame.key, query: '', top: 0 }
  }
  function remember() {
    view.top = page.scrollTop
    if (isCatalog(view.key)) lastCatalog = { ...view }
  }
  function display() {
    const frame = byKey.get(view.key)!
    const source = contentFor(shop.templateKey(view.key))
    doc.head.replaceChildren(...Array.from(source.head.children, el => doc.importNode(el, true)))
    doc.body.replaceChildren(...Array.from(source.body.children, el => doc.importNode(el, true)))
    stage.dataset.protoScreen = frame.id
    iframe.dataset.doopProtoFrame = frame.id
    page = doc.querySelector<HTMLElement>('.page')!
    shop.render(view.key, doc.body)
    if (isCatalog(view.key)) {
      filterCatalog(page, view.query, names)
      if (view.product) page.querySelector<HTMLElement>(`[data-product="${CSS.escape(view.product)}"]`)?.focus({ preventScroll: true })
    }
    document.title = (page.querySelector('h1')?.textContent ?? 'Каталог') + ' · ПРОЧАЙ'
    page.scrollTop = view.top
  }

  function navigate(target: View, replace = false) {
    remember()
    view = target
    if (!replace) index++
    views.set(index, view)
    const url = new URL('/c/' + canvas.id + '/proto/', location.origin)
    url.searchParams.set('frame', view.key)
    if (replace) history.replaceState({ shopIndex: index }, '', url)
    else history.pushState({ shopIndex: index }, '', url)
    display()
  }
  function back() {
    if (index > 0) history.back()
    else navigate({ ...lastCatalog }, true)
  }
  function search(value: string) {
    view.query = value
    view.product = undefined
    filterCatalog(page, value, names)
    page.scrollTop = 0
  }
  doc.addEventListener('input', event => {
    const input = event.target as HTMLInputElement
    if (input.matches('.catalog-search-input')) search(input.value)
  })
  doc.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLElement>('button')
    if (!button) return
    if (button.matches('.catalog-search-clear')) {
      search('')
      page.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
      return
    }
    const result = shop.activate(view.key, button)
    if (result === view.key) {
      remember()
      const row = button.closest<HTMLElement>('[data-sku]')?.dataset.sku
      const change = button.dataset.quantityChange
      display()
      if (row && change) {
        page.querySelector<HTMLElement>(`[data-sku="${CSS.escape(row)}"] [data-quantity-change="${change}"]`)?.focus({ preventScroll: true })
      }
      return
    }
    const action = button.dataset.doopAction
    if (button.matches('.back') || action === 'back') return back()
    const target = result ?? (action?.startsWith('navigate:') ? byId.get(action.slice(9))?.key : undefined)
    if (!target || shop.templateKey(target) === shop.templateKey(view.key)) return
    if (button.dataset.product) view.product = button.dataset.product
    if (target === 'catalog') {
      if (!isCatalog(view.key)) return navigate({ ...lastCatalog })
      if (button.matches('.tab')) return
    }
    const query = isCatalog(target) && isCatalog(view.key) ? view.query : ''
    navigate({ key: target, query, top: 0 }, button.matches('.pack'))
  })
  window.addEventListener('popstate', event => {
    remember()
    index = Number.isInteger(event.state?.shopIndex) ? event.state.shopIndex : 0
    const target = viewFromUrl()
    const saved = views.get(index)
    view = saved?.key === target.key ? saved : target
    views.set(index, view)
    display()
  })
  views.set(index, view)
  history.replaceState({ shopIndex: index }, '')
  display()
}

async function openShop() {
  const response = await fetch('canvas.json')
  if (!response.ok) throw new Error('Не удалось загрузить каталог.')
  startShop(await response.json())
}
openShop().catch((error: unknown) => {
  stage.textContent = error instanceof Error ? error.message : 'Не удалось открыть магазин.'
})
