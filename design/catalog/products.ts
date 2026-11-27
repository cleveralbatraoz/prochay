import catalog from './products.json'
import { readPackSize, type PackSize } from './pack-size'

export type Variant = { id: string; size: PackSize; price: number; packLabel?: string }

export type Product = Variant & {
  name: string
  group: string
  category: string
  description: string
  photo: string
  source: string
  detailPhoto?: string
  origin?: string
  region?: string
  variants?: Variant[]
}

export const products: Product[] = catalog.map(product => ({
  ...product,
  size: readPackSize(product.size, product.id),
  variants: product.variants?.map(variant => ({
    ...variant,
    size: readPackSize(variant.size, variant.id),
  })),
}))
const byId = new Map(products.map(product => [product.id, product]))
const skus = new Map<string, { product: Product; variant: Variant }>()
const photos = import.meta.glob<string>('../assets/catalog/*.jpg', { import: 'default', query: '?url', eager: true })
const priceFormat = new Intl.NumberFormat('ru-RU', { useGrouping: true })

export function variantsOf(product: Product): Variant[] {
  return [product, ...(product.variants ?? [])]
}

for (const product of products) {
  for (const variant of variantsOf(product)) skus.set(variant.id, { product, variant })
}

export function getProduct(id: string) {
  return byId.get(id)
}

export function getSku(id: string) {
  return skus.get(id)
}

export function imageUrl(product: Product, detail = false): string {
  const file = detail ? product.detailPhoto ?? product.photo : product.photo
  const url = photos['../assets/catalog/' + file]
  if (!url) throw new Error('В каталоге отсутствует фотография ' + file)
  return url
}

export function rubles(amount: number): string {
  return priceFormat.format(amount).replaceAll('\u00a0', '\u202f') + '\u00a0₽'
}
