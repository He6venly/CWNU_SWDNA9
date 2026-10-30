import { CATEGORY_IDS, FIELD_KEYS } from './constants.ts'
import { ItemInfoSchema } from './schemas.ts'
import { emptyDetails } from './item-details.ts'

export const quickItems = { 'power-bank': '보조배터리', 'cordless-iron': '고데기', liquid: '액체·젤류' } as const
type ManualCategory = typeof CATEGORY_IDS[number]

function buildManualItem(categoryId: ManualCategory, name: string, id: string) {
  return ItemInfoSchema.parse({ id, name, categoryId, identification: 'manual', confidence: 1,
    fields: Object.fromEntries(FIELD_KEYS.map(field => [field, null])), unreadFields: [...FIELD_KEYS], fieldSources: {},
    details: emptyDetails(categoryId), confirmed: false, userEdited: true,
  })
}

export function createManualItem(categoryId: keyof typeof quickItems, id: string) {
  return buildManualItem(categoryId, quickItems[categoryId], id)
}

export function createNamedManualItem(categoryId: ManualCategory, name: string, id: string) {
  return buildManualItem(categoryId, name, id)
}
