import { z } from 'zod'
import { SourceSchema } from '../schemas.ts'

export const conditionText = {
  AIRLINE_APPROVAL: ['항공사 사전 승인을 받으세요.', 'Obtain prior airline approval.'],
  INSULATE_TERMINALS: ['배터리 단자를 절연하고 개별 보호하세요.', 'Insulate terminals and protect each battery separately.'],
  KEEP_WITH_YOU: ['몸에 소지하거나 앞 좌석 주머니에 보관하세요.', 'Keep with you or in the seat pocket in front.'],
  NO_OVERHEAD: ['머리 위 선반에 보관하지 마세요.', 'Do not store in overhead bins.'],
  NO_INFLIGHT_USE: ['기내에서 보조배터리를 사용하거나 충전하지 마세요.', 'Do not use or charge power banks on board.'],
  POWER_BANK_LIMIT: ['보조배터리는 여행자 1명당 합계 2개 이하인지 확인하세요.', 'Check the limit of two power banks per passenger.'],
  HIGH_CAPACITY_SPARES: ['100Wh 초과 보조·교체용 배터리의 합산 2개 한도를 확인하세요.', 'Check the combined limit of two power banks and spare batteries over 100Wh.'],
  POWER_OFF: ['전자기기의 전원을 완전히 끄세요.', 'Completely switch off the device.'],
  PROTECT_DEVICE: ['손상과 우발 작동을 막도록 포장하세요.', 'Protect against damage and accidental activation.'],
  DEVICE_LIMIT: ['리튬배터리 휴대 전자기기 15개 초과 시 승인을 확인하세요.', 'Obtain approval if carrying more than 15 lithium-battery portable devices.'],
  REMOVE_BATTERY: ['고데기 배터리를 분리하고 단자를 보호하세요.', 'Remove the hair-styling device battery and protect its terminals.'],
  PHYSICAL_ISOLATION: ['제조사가 안내한 물리적 배터리 연결 차단을 적용하세요.', 'Apply the manufacturer’s physical battery isolation procedure.'],
  LIQUID_BAG: ['100mL 이하 용기를 1명당 1L 투명 지퍼백 1개에 넣고 밀봉하세요.', 'Seal containers of 100mL or less in one transparent 1L bag per passenger.'],
  PREVENT_LEAKS: ['누출·파손을 막도록 밀봉하고 포장하세요.', 'Seal and pack to prevent leaks and breakage.'],
  TOILETRY_LIMIT: ['개인용 화장품류는 용기당 500mL·1명 합계 2L 이하를 확인하세요.', 'Check the toiletry limits: 500mL per container and 2L per passenger.'],
  SANITIZER_LIMIT: ['에탄올 손소독제는 1명 합계 500mL 이하, 기내 용기는 100mL 이하인지 확인하세요.', 'Ethanol sanitizer: 500mL total per passenger; cabin containers must not exceed 100mL.'],
  SANITIZER_TOTAL: ['에탄올 손소독제의 개인 합계가 500mL 이하인지 확인하세요.', 'Check the ethanol sanitizer total of 500mL or less per passenger.'],
  ALCOHOL_LIMIT: ['해당 도수 주류는 1명 합계 5L 이하인지 확인하세요.', 'Check the 5L per-passenger limit for the applicable alcohol strength.'],
  LIGHTER_ON_PERSON: ['일반 라이터는 가방이 아닌 몸에 소지하세요.', 'Carry a standard lighter on your person, not in a bag.'],
  LIGHTER_LIMIT: ['일반 라이터·안전성냥의 개인 수량 한도를 확인하세요.', 'Check the personal quantity limit for lighters and safety matches.'],
  CHECK_OTHER_ITEMS: ['부분 목록입니다. 다른 짐을 포함한 개인 합산 한도를 확인하세요.', 'This is a partial list. Check personal limits including your other belongings.'],
  BAGGAGE_AND_DESTINATION: ['수하물 규격·목적지 및 환승 구간 규정은 별도 확인하세요.', 'Check baggage size/weight and destination/transit requirements separately.'],
  ADJUST_QUANTITY: ['현재 구성은 합산 한도 초과입니다. 물품 수량을 조정한 뒤 다시 판정하세요.', 'The current selection exceeds a combined limit. Adjust quantities and reassess.'],
} as const
export type ConditionCode = keyof typeof conditionText
export const ConditionSchema = z.strictObject({ code: z.enum(Object.keys(conditionText) as [ConditionCode, ...ConditionCode[]]), text: z.string().max(400), textEn: z.string().max(500), appliesTo: z.enum(['cabin', 'checked', 'both']) })
export const RequiredInfoSchema = z.strictObject({ key: z.string().max(80), text: z.string().max(600), textEn: z.string().max(600) })
export const ResultPresentationSchema = z.strictObject({
  conditions: z.array(ConditionSchema).max(30), requiredInfo: z.array(RequiredInfoSchema).max(25),
  sources: z.array(SourceSchema).max(5), ruleVersion: z.string().nullable(), reviewedAt: z.iso.datetime().nullable(), reviewBy: z.iso.datetime().nullable(), current: z.boolean(),
  airlineApproval: z.enum(['required', 'not-required', 'not-assessed']),
  inFlightUse: z.enum(['prohibited', 'not-assessed']), inFlightCharging: z.enum(['prohibited', 'not-assessed']),
  staffSummaryEn: z.string().max(1200), scopeNotice: z.string().max(600),
})
export type ResultPresentation = z.infer<typeof ResultPresentationSchema>
export function condition(code: ConditionCode, appliesTo: 'cabin' | 'checked' | 'both') {
  return { code, text: conditionText[code][0], textEn: conditionText[code][1], appliesTo }
}
