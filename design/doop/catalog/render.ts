import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

type Product = {
  id: string
  name: string
  group: 'tea' | 'ware' | 'accessories'
  category: string
  unit: string
  description?: string
  price: number
  photo: string
  source: string
}

type Fields = Record<string, string | number>
type Tab = 'catalog' | 'favorites' | 'cart'

const directory = import.meta.dirname
const groups = { all: 'Все', tea: 'Чай', ware: 'Посуда', accessories: 'Аксессуары' }
const productsWithCustomCards = new Set(['tea', 'jasmine', 'hibiscus'])
const plural = new Intl.PluralRules('ru')
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 20 })
const catalogTemplate = readFileSync(join(directory, '../catalog.html'), 'utf8')
const templates = Object.fromEntries(['featured', 'tile', 'item', 'screen', 'bag', 'saved'].map(name =>
  [name, readFileSync(join(directory, name + '.html'), 'utf8')]
))

function substitute(template: string, fields: Fields) {
  return template.replace(/\$(?:\$|([a-z_]\w*)|\{([a-z_]\w*)\})?/gi, (token, plain?: string, braced?: string) => {
    if (token === '$$') return '$'
    const key = plain ?? braced
    if (!key || !Object.hasOwn(fields, key)) throw new Error(`Неизвестное поле шаблона: ${token}`)
    return String(fields[key])
  })
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#x27;')
}

function rubles(amount: number) {
  return number.format(amount).replaceAll(',', '\u202f') + '\u00a0₽'
}

function productFields(product: Product): Fields {
  const fields: Fields = {}
  for (const [key, value] of Object.entries(product)) {
    if (typeof value === 'string') fields[key] = escapeHtml(value)
  }
  fields.detail = productsWithCustomCards.has(product.id) ? product.id : 'item-' + product.id
  fields.amount = rubles(product.price)
  return fields
}

function heart(fill: 'none' | 'currentColor') {
  return `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 5.7a5 5 0 0 0-7.1 0L12 7.1l-1.5-1.4a5 5 0 0 0-7.1 7.1L12 21l8.6-8.2a5 5 0 0 0 0-7.1Z"/></svg>`
}

function unitLabel({ unit, group }: Product) {
  if (unit.endsWith('мл') || unit.endsWith(' л')) return 'Объём'
  if (group === 'tea') return 'Фасовка'
  if (unit.endsWith('шт.') && unit !== '1 шт.') return 'В упаковке'
  return 'Количество'
}

function categoryFrame(group: string) {
  return group === 'all' ? 'catalog' : 'catalog-' + group
}

function categoryTabs(active: string) {
  return Object.entries(groups).map(([group, label]) => {
    const attributes = group === active
      ? 'aria-current="true"'
      : `data-doop-on="click" data-doop-action="navigate:${categoryFrame(group)}"`
    return `<button type="button" ${attributes}>${label}</button>`
  }).join('\n')
}

function render(output: string) {
  mkdirSync(output, { recursive: true })
  const products: Product[] = JSON.parse(readFileSync(join(directory, 'products.json'), 'utf8'))
  const frames: { id: string; name: string; file: string }[] = []

  function emit(id: string, name: string, html: string) {
    const file = id + '.html'
    writeFileSync(join(output, file), html)
    frames.push({ id, name, file })
  }

  function screen(id: string, title: string, content: string, active: Tab) {
    emit(id, title, substitute(templates.screen, {
      title: escapeHtml(title), content,
      catalog: active === 'catalog' ? 'page' : 'false',
      favorites: active === 'favorites' ? 'page' : 'false',
      cart: active === 'cart' ? 'page' : 'false',
      target: active === 'catalog' ? '' : `${active}target="navigate:${id}"`,
    }))
  }

  for (const [group, label] of Object.entries(groups)) {
    const title = group === 'all' ? 'Каталог' : label
    const selection = products.filter(product => group === 'all' || product.group === group)
    const tiles: string[] = []
    let featured = ''
    for (const product of selection) {
      const fields = productFields(product)
      if (group === 'all' && product.id === 'tea') {
        featured = `<div class="catalog-feature">${substitute(templates.featured, fields)}</div>`
      } else {
        tiles.push(substitute(templates.tile, { ...fields, separator: product.group === 'tea' ? '/' : '·' }))
      }
    }
    const word = plural.select(selection.length)
    const count = selection.length + ' ' + (word === 'one' ? 'товар' : word === 'few' ? 'товара' : 'товаров')
    emit(categoryFrame(group), title, substitute(catalogTemplate, {
      title, count, tabs: categoryTabs(group), featured, tiles: tiles.join('\n'),
    }))
  }

  for (const product of products) {
    const { id, name } = product
    if (productsWithCustomCards.has(id)) continue
    const fields = productFields(product)
    const detail = substitute(templates.item, { ...fields, unit_label: unitLabel(product), heart: heart('none') })
    screen('item-' + id, name, detail, 'catalog')
    const saved = substitute(templates.saved, { ...fields, heart: heart('currentColor') })
    screen('saved-' + id, 'Избранное · ' + name, saved, 'favorites')
    for (const quantity of [1, 2]) {
      const decrease = quantity === 1 ? 'cart-empty' : 'bag-' + id
      const increase = quantity === 1
        ? `<button type="button" class="step" aria-label="Увеличить количество" data-doop-on="click" data-doop-action="navigate:pair-${id}">+</button>`
        : '<button type="button" class="step limit" aria-label="Максимум две единицы" disabled>+</button>'
      const bag = substitute(templates.bag, { ...fields, quantity, total: rubles(product.price * quantity), decrease, increase })
      screen((quantity === 1 ? 'bag-' : 'pair-') + id, `Корзина · ${name} × ${quantity}`, bag, 'cart')
    }
  }

  for (const [id, title] of [['cart-empty', 'Корзина · пусто'], ['favorites-empty', 'Избранное · пусто']]) {
    emit(id, title, readFileSync(join(directory, '..', id + '.html'), 'utf8'))
  }
  writeFileSync(join(output, 'frames.json'), JSON.stringify(frames, null, 2) + '\n')
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: { help: { type: 'boolean', short: 'h' } } })
if (values.help || positionals.length !== 1) {
  const message = 'Собрать HTML-фреймы Doop из каталога ПРОЧАЙ\nnode design/doop/catalog/render.ts <каталог>'
  if (values.help) console.log(message)
  else console.error(message)
  process.exit(values.help ? 0 : 2)
}
render(positionals[0])
