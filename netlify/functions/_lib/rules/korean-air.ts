import { z } from 'zod'
import data from '../../../../data/rules/korean-air.json' with { type: 'json' }
import { SourceSchema } from '../../../../contract/schemas.ts'
import { RulesResponseSchema } from '../../../../contract/v2/schemas.ts'
import { CATEGORY_IDS, CONTRACT_VERSION, FLIGHT_TYPES } from '../../../../contract/v2/constants.ts'

// 규정 전용 숫자 데이터만 허용. 임의 연산식·실행 코드·외부 URL 조회 없음.
export const KoreanAirRuleSetSchema = z.strictObject({
  airlineId: z.literal('korean-air'), version: z.string().regex(/^KE-KR-\d{4}-\d{2}-\d{2}-r\d+$/),
  reviewedAt: z.iso.datetime(), reviewBy: z.iso.datetime(), powerBankEffectiveFrom: z.iso.date(),
  departureCountry: z.literal('KR'), passengers: z.literal(1), sources: z.array(SourceSchema).min(2),
  battery: z.strictObject({ approvalAboveWh: z.number().positive(), maximumWh: z.number().positive(), powerBankCount: z.int().positive(), electronicDeviceCount: z.int().positive() }),
  liquid: z.strictObject({ internationalContainerMl: z.number().positive(), toiletryContainerMl: z.number().positive(), toiletryTotalMl: z.number().positive(), sanitizerContainerMl: z.number().positive(), sanitizerTotalMl: z.number().positive(), alcoholLowPercent: z.number().min(0), alcoholHighPercent: z.number().max(100), alcoholTotalMl: z.number().positive() }),
  lighterCount: z.int().positive(),
}).superRefine((value, context) => {
  if (value.battery.approvalAboveWh >= value.battery.maximumWh || value.liquid.alcoholLowPercent >= value.liquid.alcoholHighPercent || Date.parse(value.reviewedAt) >= Date.parse(value.reviewBy) || Date.parse(value.powerBankEffectiveFrom) > Date.parse(value.reviewedAt)) {
    context.addIssue({ code: 'custom', message: '규정 경계·검수 날짜가 올바르지 않습니다.' })
  }
  if (value.sources.some(source => !['www.koreanair.com', 'www.airport.kr'].includes(new URL(source.url).hostname) || Date.parse(source.retrievedAt) > Date.parse(value.reviewedAt))) {
    context.addIssue({ code: 'custom', message: '공식 출처·조회 시점을 확인해 주세요.' })
  }
})
export const koreanAirRules = KoreanAirRuleSetSchema.parse(data)
export function rulesCurrent(now = new Date()) {
  return now.getTime() >= Date.parse(koreanAirRules.reviewedAt) && now.getTime() < Date.parse(koreanAirRules.reviewBy)
}
export function ruleMetadata(now = new Date()) {
  const current = rulesCurrent(now)
  return RulesResponseSchema.parse({ airlineId: 'korean-air', ruleVersion: current ? koreanAirRules.version : null, current,
    reviewedAt: koreanAirRules.reviewedAt, reviewBy: koreanAirRules.reviewBy, sources: koreanAirRules.sources, supportedCategories: CATEGORY_IDS,
    scope: { departureCountry: 'KR', flightTypes: FLIGHT_TYPES, passengers: 1, operatingCarrier: 'korean-air', notice: '대한항공 직접 운항편의 한국 출발 구간만 대상입니다. 공동운항·환승·목적지 세관·검역·수하물 크기와 무게는 별도 확인이 필요합니다. 품목별 미지원 유형과 주류 24도·70도 경계는 자동 확정하지 않습니다.' },
    meta: { contractVersion: CONTRACT_VERSION, isDemoRules: false, isDemoRecognition: true, isDemoLookup: true },
  })
}
