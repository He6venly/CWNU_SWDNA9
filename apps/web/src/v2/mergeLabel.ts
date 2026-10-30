import type { DetectedItem, ItemInfo } from '../../../../contract/v2/types.ts'
import { FIELD_KEYS } from '../../../../contract/v2/constants.ts'
import { assertEvaluationItems } from '../../../../contract/v2/schemas.ts'
export function mergeLabel(item: ItemInfo, label: DetectedItem): ItemInfo {
  if (label.id !== item.id || label.identification !== 'label_read') throw new Error('선택한 물품과 라벨 결과의 연결을 확인해 주세요.')
  if (item.categoryId && label.categoryId && item.categoryId !== label.categoryId) throw new Error('라벨과 기존 물품 분류가 다릅니다. 같은 제품인지 확인하고 분류를 수정해 주세요.')
  const fields = { ...item.fields }, fieldSources = { ...item.fieldSources }
  for (const key of FIELD_KEYS) {
    if (key === 'count' || fields[key] !== null || label.fields[key] === null) continue
    Object.assign(fields, { [key]: label.fields[key] }); fieldSources[key] = label.fieldSources[key]
  }
  const result: ItemInfo = { ...item, fields, fieldSources, imageId: label.imageId, bbox: label.bbox,
    identification: 'label_read', estimate: undefined, confirmed: false, userEdited: true,
    unreadFields: FIELD_KEYS.filter(key => fields[key] === null),
    ...(item.details ? { details: { ...item.details, confirmed: false } } : {}),
  }
  assertEvaluationItems([result]); return result
}
