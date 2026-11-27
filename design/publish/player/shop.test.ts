import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { chromium, type Browser, type Page } from 'playwright-core'

const tea = 'Зелёные холмы Юньнани'
const gaiwan = 'Гайвань «Пушистое облачко»'
const search = 'input[type="search"][aria-label="Поиск по названию"]'
const clear = 'button[aria-label="Очистить поиск"]'
let browser: Browser
let page: Page
let errors: string[] = []

before(async () => {
  assert.ok(process.env.DEMO_URL, 'Укажите адрес гостевого демо в DEMO_URL')
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
})

beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  page.setDefaultTimeout(8_000)
  errors = []
  page.on('console', message => {
    if (['warning', 'error', 'assert'].includes(message.type())) errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.DEMO_URL!)
  await heading('Каталог')
})

afterEach(async () => {
  await page?.close()
  assert.deepEqual(errors, [])
})
after(async () => { await browser?.close() })

function heading(name: string) {
  return page.waitForFunction(name => {
    const headings = document.querySelector('iframe')?.contentDocument?.querySelectorAll('h1,h2') ?? []
    return Array.from(headings).some(el => el.checkVisibility() && el.textContent === name)
  }, name)
}

async function tap(selector: string, text = '') {
  const point = await page.evaluate(({ selector, text }) => {
    const frame = document.querySelector('iframe')!
    const doc = frame.contentDocument!
    const el = [...doc.querySelectorAll<HTMLElement>(selector)].find(el => el.checkVisibility() && el.innerText.includes(text))
    if (!el) throw new Error(`Элемент не найден: ${selector} ${text}`)
    el.scrollIntoView({ block: 'center' })
    const bounds = el.getBoundingClientRect()
    const frameBounds = frame.getBoundingClientRect()
    const scale = frameBounds.width / frame.offsetWidth
    return {
      x: frameBounds.x + (bounds.x + bounds.width / 2) * scale,
      y: frameBounds.y + (bounds.y + bounds.height / 2) * scale,
      scrollTop: doc.querySelector('.page')!.scrollTop,
    }
  }, { selector, text })
  await page.touchscreen.tap(point.x, point.y)
  return point.scrollTop
}

function texts(selector: string) {
  return page.evaluate(selector => {
    const doc = document.querySelector('iframe')!.contentDocument!
    const elements = Array.from(doc.querySelectorAll<HTMLElement>(selector))
    return elements.filter(el => el.checkVisibility()).map(el => el.innerText)
  }, selector)
}

async function product(name: string) {
  const position = await tap('[data-product]', name)
  await heading(name)
  return position
}

test('Поиск в категории, возврат к товару и пустая выдача', async () => {
  await tap('.catalog-tabs button', 'Чай')
  await heading('Чай')
  await tap(search)
  await page.keyboard.insertText('Ча')
  const matches = await texts('[data-product] :is(.hero-name, .product-name)')
  assert.ok(matches.length > 1 && matches.every(name => name.toLowerCase().includes('ча')))
  const position = await product('Жоу Гуй Лао Ча')
  assert.ok(position > 0)
  await tap('button.back', 'Назад')
  await heading('Чай')
  const restored = await page.evaluate(() => {
    const doc = document.querySelector('iframe')!.contentDocument!
    return [doc.querySelector('input')!.value, doc.querySelector('.page')!.scrollTop]
  })
  assert.deepEqual(restored, ['Ча', position])
  await tap(clear)
  await page.keyboard.insertText('несуществующий товар')
  await heading('Ничего не найдено')
  assert.deepEqual(await texts('[data-product]'), [])
  await tap(clear)
  assert.ok((await texts('[data-product]')).some(text => text.includes(tea)))
  assert.ok((await texts('[data-product]')).every(text => !text.includes(gaiwan)))
})

test('Корзина суммирует разные товары и сбрасывается при перезагрузке', async () => {
  await product(tea)
  await tap('.buy')
  await heading('Корзина')
  await tap('.bottom-nav button', 'Каталог')
  await product(gaiwan)
  await tap('.buy')
  await heading('Корзина')
  assert.deepEqual(await texts('.cart-row h2'), [tea, gaiwan])
  const total = async () => Number((await texts('.summary strong'))[0].replace(/\D/g, ''))
  assert.equal(await total(), 2350)
  await tap(`button[aria-label^="Увеличить количество: ${gaiwan}"]`)
  assert.deepEqual(await texts('.stepper > span'), ['1', '2'])
  assert.equal(await total(), 3850)
  await tap(`button[aria-label^="Уменьшить количество: ${gaiwan}"]`)
  assert.equal(await total(), 2350)
  await page.reload()
  await heading('Пока пусто')
})

test('Избранное хранит несколько товаров и позволяет убрать каждый отдельно', async () => {
  await product(tea)
  await tap('button[aria-label="Добавить в избранное"]')
  await heading('Избранное')
  await tap('.bottom-nav button', 'Каталог')
  await product(gaiwan)
  await tap('button[aria-label="Добавить в избранное"]')
  await heading('Избранное')
  assert.deepEqual(await texts('.saved-title'), [tea, gaiwan])
  await tap(`button[aria-label="Убрать ${tea} из избранного"]`)
  assert.deepEqual(await texts('.saved-title'), [gaiwan])
  await tap(`button[aria-label="Убрать ${gaiwan} из избранного"]`)
  await heading('Пока нет избранного')
})
