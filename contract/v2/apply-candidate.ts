import type { ItemInfo } from './types.ts'
import { CandidateSchema, assertEvaluationItems } from './schemas.ts'
import { FIELD_KEYS } from './constants.ts'

// 후보 선택은 확인 완료가 아님. 이미 읽은 라벨·사용자 값을 보존하고 빈 값만 채움.
export function applyCandidate(item: ItemInfo, value: unknown): ItemInfo {
  const candidate = CandidateSchema.parse(value)
  if (candidate.itemId !== item.id) throw new Error('candidate item mismatch')
  const fields = { ...item.fields }, fieldSources = { ...item.fieldSources }
  for (const field of FIELD_KEYS) {
    if (field === 'count' || fields[field] !== null || candidate.fields[field] === null) continue
    Object.assign(fields, { [field]: candidate.fields[field] })
    fieldSources[field] = { source: 'lookup', sourceUrl: candidate.sources[0]!.url, confirmed: false, ...(field === 'volts' ? { voltageType: 'unknown' as const } : {}) }
  }
  const result = { ...item, fields, fieldSources, unreadFields: FIELD_KEYS.filter(field => fields[field] === null), confirmed: false, userEdited: true,
    ...(item.details ? { details: { ...item.details, confirmed: false } } : {}),
  }
  assertEvaluationItems([result])
  return result
}
