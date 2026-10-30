import { FIELD_KEYS } from './constants.ts'
import { ItemInfoSchema } from './schemas.ts'
import { emptyDetails } from './item-details.ts'

export const quickItems = { 'power-bank': '보조배터리', 'cordless-iron': '고데기', liquid: '액체·젤류' } as const
export function createManualItem(categoryId: keyof typeof quickItems, id: string) {
  return ItemInfoSchema.parse({ id, name: quickItems[categoryId], categoryId, identification: 'manual', confidence: 1,
    fields: Object.fromEntries(FIELD_KEYS.map(field => [field, null])), unreadFields: [...FIELD_KEYS], fieldSources: {},
    details: emptyDetails(categoryId), confirmed: false, userEdited: true,
  })
}
