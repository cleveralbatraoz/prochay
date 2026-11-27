const units = {
  g: { kind: 'weight', label: 'г' },
  kg: { kind: 'weight', label: 'кг' },
  ml: { kind: 'volume', label: 'мл' },
  l: { kind: 'volume', label: 'л' },
  piece: { kind: 'count', label: 'шт.' },
  set: { kind: 'count', label: 'набор' },
} as const

export type Unit = keyof typeof units
export type PackSize = { amount: number; unit: Unit }

function isUnit(value: string): value is Unit {
  return Object.hasOwn(units, value)
}

export function unitKind(unit: Unit) {
  return units[unit].kind
}

export function readPackSize(size: { amount: number; unit: string }, skuId: string): PackSize {
  const { amount, unit } = size
  if (!isUnit(unit)) throw new Error(`Неизвестная единица фасовки «${unit}» у товара ${skuId}`)
  if (!Number.isFinite(amount) || amount <= 0 || (unitKind(unit) === 'count' && !Number.isInteger(amount))) {
    throw new Error(`Недопустимый размер фасовки у товара ${skuId}: ${amount} ${unit}`)
  }
  return { amount, unit }
}

const plurals = new Intl.PluralRules('ru')

export function formatPackSize({ amount, unit }: PackSize): string {
  let label: string = units[unit].label
  if (unit === 'set') {
    const form = plurals.select(amount)
    if (form === 'few') label = 'набора'
    if (form === 'many') label = 'наборов'
  }
  return amount.toLocaleString('ru-RU') + ' ' + label
}
