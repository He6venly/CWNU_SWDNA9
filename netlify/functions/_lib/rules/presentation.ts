import type { ItemInfo, ItemResult, ResultPresentation } from '../../../../contract/v2/types.ts'
import { condition } from '../../../../contract/v2/presentation.ts'
import { detailLabels } from '../../../../contract/v2/item-details.ts'
import { labels } from '../../../../contract/v2/labels.ts'
import { koreanAirRules as rules } from './korean-air.ts'

export function buildPresentation(item: ItemInfo, result: ItemResult, conditions: ResultPresentation['conditions'], quantityIssue: boolean): ResultPresentation {
  const requiredInfo: ResultPresentation['requiredInfo'] = []
  if (!item.confirmed || !item.details?.confirmed) requiredInfo.push({ key: 'confirmation', text: '물품 종류·제품 정보·안전 정보를 직접 확인해 주세요.', textEn: 'Please confirm the item type, product specifications and safety information.' })
  for (const field of result.missingFields) requiredInfo.push({ key: `fields.${field}`, text: `${labels.fields[field]} 값을 확인해 주세요.`, textEn: `Confirm the ${field} value using the product label or reliable product information.` })
  const info = item.details
  const keys = !info ? [] : info.type === 'power-bank' ? ['batteryType', 'damaged', 'recalled']
    : info.type === 'cordless-iron' ? ['powerSource', ...(info.powerSource === 'lithium-ion-battery' ? ['isolation', 'damaged', 'recalled'] : [])]
    : info.type === 'liquid' ? ['liquidType', ...(info.liquidType === 'alcohol' ? ['alcoholPercent'] : [])]
    : info.type === 'lighter' ? ['lighterType'] : info.type === 'electronics' ? ['deviceType', 'batteryType', ...(info.batteryType === 'lithium-ion' ? ['damaged', 'recalled'] : [])]
    : ['itemType', 'hasRestrictedParts']
  for (const key of keys) if (info && (info as unknown as Record<string, unknown>)[key] === null) requiredInfo.push({
    key: `details.${key}`, text: `${detailLabels[key as keyof typeof detailLabels]} 정보를 확인해 주세요.`, textEn: `Confirm the product detail: ${key}.`,
  })
  if (!info) requiredInfo.push({ key: 'details', text: '추가 제품·안전 정보를 입력해 주세요.', textEn: 'Provide the additional product and safety details.' })
  for (const side of ['cabin', 'checked'] as const) if (result[side].verdict === 'NEEDS_INFO') requiredInfo.push({ key: `assessment.${side}`, text: result[side].reason, textEn: `The ${side} assessment needs product or rule confirmation. Please refer to the accompanying Korean explanation.` })
  if (quantityIssue) conditions.push(condition('ADJUST_QUANTITY', 'both'))
  const unique = conditions.filter((entry, index) => conditions.findIndex(other => other.code === entry.code && other.appliesTo === entry.appliesTo) === index)
  const batteryAssessed = unique.some(entry => ['POWER_BANK_LIMIT', 'DEVICE_LIMIT'].includes(entry.code))
  const powerBankAssessed = unique.some(entry => entry.code === 'NO_INFLIGHT_USE')
  return {
    conditions: unique, requiredInfo, sources: rules.sources.filter((_, index) => index === 0 || index === 1 && item.categoryId === 'power-bank' || index === 2 && info?.type === 'liquid' && info.liquidType === 'alcohol'),
    ruleVersion: rules.version, reviewedAt: rules.reviewedAt, reviewBy: rules.reviewBy, current: true,
    airlineApproval: unique.some(entry => entry.code === 'AIRLINE_APPROVAL') ? 'required' : batteryAssessed ? 'not-required' : 'not-assessed',
    inFlightUse: powerBankAssessed ? 'prohibited' : 'not-assessed', inFlightCharging: powerBankAssessed ? 'prohibited' : 'not-assessed',
    staffSummaryEn: `Cabin: ${result.cabin.verdict}. Checked baggage: ${result.checked.verdict}. ${quantityIssue ? 'Current selection exceeds a combined limit. Adjust quantities and reassess. ' : ''}One passenger, Korean Air operated flight departing Korea. Reference only; final decisions rest with airline and security staff.`,
    scopeNotice: '대한항공 직접 운항·한국 출발·여행자 1명 기준. 공동운항·환승·목적지 검역·세관·수하물 규격은 별도 확인 대상입니다.',
  }
}
