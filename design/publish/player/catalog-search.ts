function normalize(text: string) {
  return text.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е')
}

const plural = new Intl.PluralRules('ru')
const countWords: Record<string, string> = { one: 'товар', few: 'товара', many: 'товаров' }

export function filterCatalog(page: HTMLElement, query: string, names: ReadonlyMap<string, string>) {
  const input = page.querySelector<HTMLInputElement>('.catalog-search-input')
  if (!input) return
  input.value = query
  const words = normalize(query).split(/\s+/).filter(Boolean)
  let count = 0
  for (const tile of page.querySelectorAll<HTMLElement>('[data-product]')) {
    const name = normalize(names.get(tile.dataset.product!) ?? '')
    const matches = words.every(word => name.includes(word))
    const item = tile.closest<HTMLElement>('.catalog-feature') ?? tile
    item.hidden = !matches
    if (matches) count++
  }
  page.querySelector<HTMLElement>('.catalog-search-clear')!.hidden = !query
  page.querySelector<HTMLElement>('.catalog-no-results')!.hidden = count !== 0
  page.querySelector<HTMLElement>('.catalog-count')!.textContent = count + ' ' + (countWords[plural.select(count)] ?? 'товара')
}
