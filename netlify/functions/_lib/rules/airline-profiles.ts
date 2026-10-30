import { z } from 'zod'
import data from '../../../../data/rules/airline-profiles.json' with { type: 'json' }
import { SourceSchema } from '../../../../contract/schemas.ts'
import { CATEGORY_IDS, CONTRACT_VERSION } from '../../../../contract/v2/constants.ts'
import { RulesResponseSchema } from '../../../../contract/v2/schemas.ts'

const BatterySchema = z.strictObject({
  approvalAboveWh: z.number().positive(), powerBankMaximumWh: z.number().positive(), maximumWh: z.number().positive(),
  powerBankCount: z.int().positive(), electronicDeviceCount: z.int().positive(),
}).superRefine((value, context) => {
  if (value.approvalAboveWh > value.powerBankMaximumWh || value.powerBankMaximumWh > value.maximumWh) context.addIssue({ code: 'custom', message: '배터리 용량 경계가 올바르지 않습니다.' })
})
const LiquidSchema = z.strictObject({
  internationalContainerMl: z.number().positive(), toiletryContainerMl: z.number().positive(), toiletryTotalMl: z.number().positive(),
  sanitizerContainerMl: z.number().positive(), sanitizerTotalMl: z.number().positive(), alcoholLowPercent: z.number().min(0),
  alcoholHighPercent: z.number().max(100), alcoholTotalMl: z.number().positive(),
})
const ProfileSchema = z.strictObject({
  airlineId: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1), version: z.string().regex(/^[A-Z0-9]+-KR-\d{4}-\d{2}-\d{2}-r\d+$/),
  flightTypes: z.array(z.enum(['domestic', 'international'])).min(1).max(2), battery: BatterySchema,
  lighterCount: z.int().nonnegative(), sources: z.array(SourceSchema).min(1).max(3),
})
const DataSchema = z.strictObject({
  reviewedAt: z.iso.datetime(), reviewBy: z.iso.datetime(), departureCountry: z.literal('KR'), passengers: z.literal(1),
  commonSources: z.array(SourceSchema).min(2).max(3), liquid: LiquidSchema, profiles: z.array(ProfileSchema).length(16),
}).superRefine((value, context) => {
  if (Date.parse(value.reviewedAt) >= Date.parse(value.reviewBy)) context.addIssue({ code: 'custom', message: '검수 날짜가 올바르지 않습니다.' })
  if (new Set(value.profiles.map(profile => profile.airlineId)).size !== value.profiles.length) context.addIssue({ code: 'custom', message: '항공사 ID가 중복되었습니다.' })
  if ([...value.commonSources, ...value.profiles.flatMap(profile => profile.sources)].some(source => Date.parse(source.retrievedAt) > Date.parse(value.reviewedAt))) context.addIssue({ code: 'custom', message: '출처 조회 시점이 검수일보다 늦습니다.' })
})

const parsed = DataSchema.parse(data)
export type AirlineRuleProfile = z.infer<typeof ProfileSchema> & { liquid: z.infer<typeof LiquidSchema>; reviewedAt: string; reviewBy: string; allSources: z.infer<typeof SourceSchema>[] }

export const airlineRuleProfiles: AirlineRuleProfile[] = parsed.profiles.map(profile => ({
  ...profile, liquid: parsed.liquid, reviewedAt: parsed.reviewedAt, reviewBy: parsed.reviewBy,
  allSources: [...profile.sources, ...parsed.commonSources].slice(0, 5),
}))

export function airlineRuleProfile(id: string) { return airlineRuleProfiles.find(profile => profile.airlineId === id) ?? null }
export function airlineRulesCurrent(now = new Date()) { return now.getTime() >= Date.parse(parsed.reviewedAt) && now.getTime() < Date.parse(parsed.reviewBy) }
export function airlineRuleMetadata(id: string, now = new Date()) {
  const profile = airlineRuleProfile(id)
  if (!profile) return null
  const current = airlineRulesCurrent(now)
  return RulesResponseSchema.parse({
    airlineId: profile.airlineId, ruleVersion: current ? profile.version : null, current,
    reviewedAt: profile.reviewedAt, reviewBy: profile.reviewBy, sources: profile.allSources,
    supportedCategories: CATEGORY_IDS,
    scope: {
      departureCountry: 'KR', flightTypes: profile.flightTypes, passengers: 1, operatingCarrier: profile.airlineId,
      notice: `${profile.name} 직접 운항 한국 출발편·여행자 1명 기준입니다. 항공사 공식 규정과 한국 출발 보안 기준을 함께 적용하며 공동운항·환승·목적지 세관·검역·수하물 규격은 별도 확인해야 합니다.`,
    },
    meta: { contractVersion: CONTRACT_VERSION, isDemoRules: false, isDemoRecognition: true, isDemoLookup: true },
  })
}
