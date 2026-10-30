import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveAction, evaluateAirline, evaluateKoreanAir, resolveEnergy } from '../netlify/functions/_lib/rules/evaluate.ts'
import { koreanAirRules, KoreanAirRuleSetSchema } from '../netlify/functions/_lib/rules/korean-air.ts'
import { ItemInfoSchema, RulesResponseSchema } from '../contract/v2/schemas.ts'
import { FIELD_KEYS } from '../contract/v2/constants.ts'
import { emptyDetails } from '../contract/v2/item-details.ts'
import type { ItemDetails } from '../contract/v2/item-details.ts'
import type { Fields, ItemInfo } from '../contract/v2/types.ts'
import { createApiClient } from '../contract/v2/client.ts'
import { createMockClient } from '../contract/v2/mock.ts'
import { handleApi } from '../netlify/functions/_lib/api.ts'
import { readFile } from 'node:fs/promises'
import { supportedAirlines } from '../contract/v2/airlines.ts'
import { airlineRuleMetadata } from '../netlify/functions/_lib/rules/airlines.ts'

const when = new Date('2026-10-31T09:00:00Z')
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(when) })
afterEach(() => vi.useRealTimers())
const defaults: Record<ItemDetails['type'], Record<string, unknown>> = {
  'power-bank': { batteryType: 'lithium-ion', damaged: false, recalled: false },
  'cordless-iron': { powerSource: 'lithium-ion-battery', isolation: 'removable', damaged: false, recalled: false },
  liquid: { liquidType: 'water-drink', alcoholPercent: null }, lighter: { lighterType: 'standard' },
  electronics: { deviceType: 'portable-electronic', batteryType: 'lithium-ion', damaged: false, recalled: false },
  'general-items': { itemType: 'clothing-book', hasRestrictedParts: false },
}
function item(type: ItemDetails['type'] = 'power-bank', fields: Partial<Fields> = {}, details: Record<string, unknown> = {}): ItemInfo {
  const values: Fields = { brand: null, modelName: null, wh: ['power-bank', 'cordless-iron', 'electronics'].includes(type) ? 74 : null, mah: null, volts: null, ml: type === 'liquid' ? 100 : null, count: 1, ...fields }
  return ItemInfoSchema.parse({ id: 'item-1', name: '검증 물품', categoryId: type, confidence: 1, identification: 'label_read', imageId: 'image-1',
    fields: values, unreadFields: FIELD_KEYS.filter(key => values[key] === null),
    fieldSources: Object.fromEntries(FIELD_KEYS.filter(key => values[key] !== null).map(key => [key, { source: 'user', confirmed: true, ...(key === 'volts' ? { voltageType: 'nominal' } : {}) }])),
    confirmed: true, userEdited: true, details: { ...emptyDetails(type), ...defaults[type], confirmed: true, ...details },
  })
}
const request = (items: ItemInfo[], flightType: 'domestic' | 'international' = 'domestic') => ({ airlineId: 'korean-air', departureCountry: 'KR' as const, flightType, inventoryComplete: true, items })
const result = (entry: ItemInfo, flightType: 'domestic' | 'international' = 'domestic') => evaluateKoreanAir(request([entry], flightType), when).results[0]!
const post = (body: unknown) => handleApi(new Request('https://api.example/api/v2/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), {})

describe('공식 규정 경계 — 독립 기대값', () => {
  it.each([
    [100, 'CONDITIONAL', 'PROHIBITED', false], [100.0001, 'CONDITIONAL', 'PROHIBITED', true],
    [160, 'CONDITIONAL', 'PROHIBITED', true], [160.0001, 'PROHIBITED', 'PROHIBITED', false],
  ] as const)('보조배터리 %sWh', (wh, cabin, checked, approval) => {
    const output = result(item('power-bank', { wh }))
    expect(output.cabin.verdict).toBe(cabin); expect(output.checked.verdict).toBe(checked)
    expect(output.cabin.reason.includes('사전 승인')).toBe(approval)
  })
  it.each([
    ['water-drink', 100, 1, 'international', 'CONDITIONAL', 'CONDITIONAL'],
    ['water-drink', 100.01, 1, 'international', 'PROHIBITED', 'CONDITIONAL'],
    ['water-drink', 1000, 1, 'domestic', 'ALLOWED', 'CONDITIONAL'],
    ['toiletry', 500, 4, 'domestic', 'CONDITIONAL', 'CONDITIONAL'],
    ['toiletry', 500.01, 1, 'domestic', 'PROHIBITED', 'PROHIBITED'],
    ['toiletry', 500, 5, 'domestic', 'PROHIBITED', 'PROHIBITED'],
    ['ethanol-sanitizer', 100, 5, 'domestic', 'CONDITIONAL', 'CONDITIONAL'],
    ['ethanol-sanitizer', 100, 6, 'domestic', 'PROHIBITED', 'PROHIBITED'],
    ['ethanol-sanitizer', 100.01, 1, 'domestic', 'PROHIBITED', 'CONDITIONAL'],
  ] as const)('%s %smL × %s, %s', (liquidType, ml, count, flightType, cabin, checked) => {
    const output = result(item('liquid', { ml, count }, { liquidType }), flightType)
    expect(output.cabin.verdict).toBe(cabin); expect(output.checked.verdict).toBe(checked)
  })
  it.each([
    [23.99, 'ALLOWED', 'CONDITIONAL'], [24, 'NEEDS_INFO', 'NEEDS_INFO'], [24.01, 'CONDITIONAL', 'CONDITIONAL'],
    [69.99, 'CONDITIONAL', 'CONDITIONAL'], [70, 'NEEDS_INFO', 'NEEDS_INFO'], [70.01, 'PROHIBITED', 'PROHIBITED'],
  ] as const)('주류 %s도: 출처 상충 경계는 확정하지 않음', (alcoholPercent, cabin, checked) => {
    const output = result(item('liquid', {}, { liquidType: 'alcohol', alcoholPercent }))
    expect(output.cabin.verdict).toBe(cabin); expect(output.checked.verdict).toBe(checked)
  })
  it.each(['removable', 'physical-cutoff', 'software-lock', 'none', null] as const)('무선 고데기 차단 방식 %s', isolation => {
    const output = result(item('cordless-iron', {}, { isolation }))
    expect(output.cabin.verdict).toBe(isolation === null ? 'NEEDS_INFO' : ['software-lock', 'none'].includes(isolation) ? 'PROHIBITED' : 'CONDITIONAL')
    expect(output.checked.verdict).toBe('PROHIBITED')
  })
  it.each(['torch', 'plasma', 'fuel'] as const)('%s 라이터·연료는 수량 정보 없이도 양쪽 불가', lighterType => {
    const output = result(item('lighter', { count: null }, { lighterType }))
    expect(output).toMatchObject({ cabin: { verdict: 'PROHIBITED' }, checked: { verdict: 'PROHIBITED' }, action: 'LEAVE_BEHIND' })
  })
  it('6개 분류의 대표 입력을 각각 판정', () => {
    expect(result(item('lighter')).cabin.verdict).toBe('CONDITIONAL')
    expect(result(item('electronics')).checked.verdict).toBe('CONDITIONAL')
    expect(result(item('general-items'))).toMatchObject({ cabin: { verdict: 'ALLOWED' }, checked: { verdict: 'ALLOWED' }, action: 'PUT_IN_CABIN' })
    expect(result(item('general-items', {}, { hasRestrictedParts: true })).cabin.verdict).toBe('NEEDS_INFO')
    expect(result(item('cordless-iron', {}, { powerSource: 'gas' })).cabin.verdict).toBe('NEEDS_INFO')
    expect(result(item('electronics', {}, { batteryType: 'lithium-metal' })).cabin.verdict).toBe('NEEDS_INFO')
  })
})

describe('제품 정보·전력량·수량 교차검증', () => {
  it('공칭 전압으로만 계산하고 반올림 전 값으로 판정', () => {
    const entry = item('power-bank', { wh: null, mah: 40001, volts: 4 })
    const output = result(entry)
    expect(output.derivedFields.wh).toMatchObject({ value: 160.004, displayValue: 160 })
    expect(output.cabin.verdict).toBe('PROHIBITED')
    entry.fieldSources.volts!.voltageType = 'output'
    expect(result(entry)).toMatchObject({ cabin: { verdict: 'NEEDS_INFO' }, checked: { verdict: 'PROHIBITED' }, derivedFields: {} })
  })
  it('임의의 3.7V를 채우지 않고 mAh만 있으면 정보 요청', () => {
    expect(result(item('power-bank', { wh: null, mah: 20000 })).missingFields).toContain('wh')
    expect(resolveEnergy(item('power-bank', { wh: null, mah: 20000 })).value).toBeUndefined()
  })
  it('직접 Wh와 계산값이 충돌하면 작은 값을 골라 허용하지 않음', () => {
    const output = result(item('power-bank', { wh: 100, mah: 30000, volts: 3.7 }))
    expect(output.cabin.verdict).toBe('NEEDS_INFO'); expect(output.cabin.reason).toContain('다릅니다')
    expect(result(item('power-bank', { wh: 74, mah: 20000, volts: 3.7 })).cabin.verdict).toBe('CONDITIONAL')
  })
  it('미확인 제품 조회값은 판정 근거로 사용하지 않음', () => {
    const entry = item(); entry.fieldSources.wh = { source: 'lookup', sourceUrl: 'https://manufacturer.example/product', confirmed: false }
    expect(result(entry).cabin.verdict).toBe('NEEDS_INFO')
    entry.fieldSources.wh.confirmed = true
    expect(result(entry).cabin.verdict).toBe('CONDITIONAL')
  })
  it('라벨 숫자가 있어도 물품·추가 정보 확인 전에는 양쪽 미확정', () => {
    const entry = item(); entry.confirmed = false
    expect(result(entry).checked.verdict).toBe('NEEDS_INFO')
    entry.confirmed = true; delete entry.details
    expect(result(entry).cabin.verdict).toBe('NEEDS_INFO')
    entry.details = emptyDetails('power-bank')
    expect(result(entry).cabin.verdict).toBe('NEEDS_INFO')
  })
  it('손상 위험은 Wh 누락보다 우선하고 확인되지 않은 안전 상태는 허용하지 않음', () => {
    expect(result(item('power-bank', { wh: null }, { damaged: true })).cabin.verdict).toBe('PROHIBITED')
    expect(result(item('power-bank', {}, { damaged: null })).cabin.verdict).toBe('NEEDS_INFO')
    expect(result(item('electronics', {}, { recalled: true })).checked.verdict).toBe('NEEDS_INFO')
    expect(result(item('electronics', {}, { batteryType: 'none', damaged: true })).cabin.verdict).toBe('NEEDS_INFO')
    expect(result(item('cordless-iron', {}, { powerSource: 'mains', recalled: true })).cabin.verdict).toBe('NEEDS_INFO')
  })
  it('보조배터리는 서로 다른 카드의 수량도 합산, 현재 구성 불가·조정 안내', () => {
    const first = item('power-bank', { count: 2 }), second = { ...item(), id: 'item-2' }
    const output = evaluateKoreanAir(request([first, second]), when)
    expect(output.results.every(r => r.cabin.verdict === 'PROHIBITED' && r.checked.verdict === 'PROHIBITED' && r.action === 'CHECK_CONDITIONS')).toBe(true)
    expect(output.results.every(r => r.staffSummary.includes('현재 목록'))).toBe(true)
    expect(result(first).cabin.verdict).toBe('CONDITIONAL')
  })
  it('주류 합계 5L 경계와 전자기기 15개 승인 조건', () => {
    expect(result(item('liquid', { ml: 1000, count: 5 }, { liquidType: 'alcohol', alcoholPercent: 40 })).checked.verdict).toBe('CONDITIONAL')
    expect(result(item('liquid', { ml: 1000, count: 6 }, { liquidType: 'alcohol', alcoholPercent: 40 })).checked.verdict).toBe('PROHIBITED')
    expect(result(item('electronics', { count: 16 })).cabin.reason).toContain('승인')
    expect(result(item('electronics', { count: 16 })).checked.reason).toContain('승인')
    expect(result(item('electronics', { wh: 160.001 })).cabin.verdict).toBe('PROHIBITED')
  })
  it('수량 미확인도 독립적으로 확정된 용기 금지를 지우지 않음', () => {
    const output = result(item('liquid', { ml: 200, count: null }), 'international')
    expect(output).toMatchObject({ cabin: { verdict: 'PROHIBITED' }, checked: { verdict: 'NEEDS_INFO' } })
    expect(result(item('liquid', { ml: null, count: null }, { liquidType: 'alcohol', alcoholPercent: 80 })).cabin.verdict).toBe('PROHIBITED')
  })
  it('부분 목록은 합산 한도 확인 안내, 입력 객체를 수정하지 않음', () => {
    const input = { ...request([item()]), inventoryComplete: false }, snapshot = structuredClone(input)
    const output = evaluateKoreanAir(input, when)
    expect(output.results[0]!.cabin.reason).toContain('부분 목록')
    expect(input).toEqual(snapshot)
  })
})

describe('양쪽 결과의 권장 조치 16조합', () => {
  it.each([
    ['ALLOWED', 'ALLOWED', 'PUT_IN_CABIN'], ['ALLOWED', 'CONDITIONAL', 'PUT_IN_CABIN'], ['ALLOWED', 'PROHIBITED', 'PUT_IN_CABIN'], ['ALLOWED', 'NEEDS_INFO', 'PUT_IN_CABIN'],
    ['CONDITIONAL', 'ALLOWED', 'PUT_IN_CHECKED'], ['CONDITIONAL', 'CONDITIONAL', 'CHECK_CONDITIONS'], ['CONDITIONAL', 'PROHIBITED', 'CHECK_CONDITIONS'], ['CONDITIONAL', 'NEEDS_INFO', 'CHECK_CONDITIONS'],
    ['PROHIBITED', 'ALLOWED', 'PUT_IN_CHECKED'], ['PROHIBITED', 'CONDITIONAL', 'CHECK_CONDITIONS'], ['PROHIBITED', 'PROHIBITED', 'LEAVE_BEHIND'], ['PROHIBITED', 'NEEDS_INFO', 'CHECK_CONDITIONS'],
    ['NEEDS_INFO', 'ALLOWED', 'PUT_IN_CHECKED'], ['NEEDS_INFO', 'CONDITIONAL', 'CHECK_CONDITIONS'], ['NEEDS_INFO', 'PROHIBITED', 'CHECK_CONDITIONS'], ['NEEDS_INFO', 'NEEDS_INFO', 'CHECK_CONDITIONS'],
  ] as const)('%s / %s → %s', (cabin, checked, expected) => expect(deriveAction(cabin, checked)).toBe(expected))
})

describe('규정 수명·공식 출처·실제 HTTP handler 계약', () => {
  const api = createApiClient({ baseUrl: 'https://api.example', fetch: async (url, init) => handleApi(new Request(url, init), {}) })
  it('키·외부 호출 없이 실제 항공사 규정으로 판정하며 시연 인식과 구분', async () => {
    const network = vi.spyOn(globalThis, 'fetch')
    try {
      const output = await api.evaluate(request([item()]))
      expect(output.meta).toMatchObject({ isDemoRules: false, isDemoRecognition: true })
      expect(output.ruleVersion).toBe('KE-KR-2026-10-31-r2'); expect(output.results[0]!.isDemo).toBe(false)
      expect(network).not.toHaveBeenCalled()
    } finally { network.mockRestore() }
  })
  it('국내 여객 항공사 전체와 한국 출발 해외 Top 5를 선택·판정', async () => {
    const list = (await api.airlines()).airlines.filter((airline) => !airline.isDemo)
    expect(list).toHaveLength(16)
    expect(list.filter((airline) => airline.supportedFlightTypes.includes('domestic'))).toHaveLength(10)
    const output = await api.evaluate({ ...request([item('general-items')], 'international'), airlineId: 'delta-air-lines', resultFormat: 'detailed' })
    expect(output).toMatchObject({ airlineId: 'delta-air-lines', meta: { isDemoRules: false }, results: [{ cabin: { verdict: 'ALLOWED' } }] })
    expect(output.results[0]!.presentation?.scopeNotice).toContain('델타항공')
  })
  it('항공사별 용량·휴대 제한을 독립 적용', () => {
    const powerBank = item('power-bank', { wh: 120 })
    const base = { ...request([powerBank], 'international'), resultFormat: 'detailed' as const }
    expect(evaluateAirline({ ...base, airlineId: 'asiana-airlines' }, when).results[0]!.cabin.verdict).toBe('CONDITIONAL')
    expect(evaluateAirline({ ...base, airlineId: 'delta-air-lines' }, when).results[0]!.cabin.verdict).toBe('PROHIBITED')
    expect(evaluateAirline({ ...request([item('lighter')], 'international'), airlineId: 'air-china' }, when).results[0]!.cabin.verdict).toBe('PROHIBITED')
  })
  it('16개 항공사 모두 개별 버전·공식 출처로 판정', () => {
    expect(supportedAirlines.map(airline => String(airline.id)).includes('trinity-airways')).toBe(false)
    expect(supportedAirlines.map(airline => String(airline.name)).includes('트리니티항공')).toBe(false)
    expect(supportedAirlines.find(airline => airline.id === 'tway-air')?.name).toBe('티웨이항공')
    for (const airline of supportedAirlines) {
      const metadata = airlineRuleMetadata(airline.id, when)
      expect(metadata?.current).toBe(true)
      expect(metadata?.ruleVersion).toMatch(/-KR-2026-10-31-r\d+$/)
      expect(metadata?.sources.some(source => !source.url.includes('molit.go.kr') && !source.url.includes('airport.kr'))).toBe(true)
      const flightType = airline.supportedFlightTypes[0]
      expect(evaluateAirline({ ...request([item('general-items')], flightType), airlineId: airline.id }, when).ruleVersion).toBe(metadata?.ruleVersion)
    }
  })
  it('규정 출처 API·생성된 목업·쿼리 명세 연결', async () => {
    const info = await api.rules('korean-air')
    expect(info.current).toBe(true); expect(info.scope.passengers).toBe(1); expect(info.sources).toHaveLength(4)
    expect(info.supportedCategories).toHaveLength(6)
    const mock = await createMockClient({ delayMs: 0 }).rules('korean-air')
    expect(mock.meta.isDemoRules).toBe(true); expect(mock.current).toBe(false); expect(mock.ruleVersion).toBeNull()
    expect(RulesResponseSchema.parse(JSON.parse(await readFile(new URL('../contract/v2/fixtures/rules.json', import.meta.url), 'utf8')))).toEqual(mock)
    const duplicate = await handleApi(new Request('https://api.example/api/v2/rules?airlineId=korean-air&airlineId=demo-airline'), {})
    expect(duplicate.status).toBe(400)
    await expect(api.rules('demo-airline')).rejects.toMatchObject({ status: 404 })
  })
  it('검수기한 만료·미래 검수는 자동 판정 중단', async () => {
    expect(evaluateKoreanAir(request([item()]), new Date('2026-10-29T23:59:59Z')).results[0]!.cabin.verdict).toBe('NEEDS_INFO')
    vi.setSystemTime(new Date('2026-11-30T00:00:00Z'))
    const output = evaluateKoreanAir(request([item()]))
    expect(output.ruleVersion).toBeNull(); expect(output.results[0]!.checked.verdict).toBe('NEEDS_INFO')
    expect((await api.meta()).capabilities.evaluation).toBe('unavailable')
    expect((await api.rules('korean-air')).current).toBe(false)
    await expect(api.evaluate(request([item()]))).rejects.toMatchObject({ status: 409 })
  })
  it('경계 역전·외부 출처·유효기간 역전 데이터는 로드 거부', () => {
    expect(() => KoreanAirRuleSetSchema.parse({ ...koreanAirRules, battery: { ...koreanAirRules.battery, maximumWh: 50 } })).toThrow()
    expect(() => KoreanAirRuleSetSchema.parse({ ...koreanAirRules, reviewBy: koreanAirRules.reviewedAt })).toThrow()
    expect(() => KoreanAirRuleSetSchema.parse({ ...koreanAirRules, sources: koreanAirRules.sources.map(s => ({ ...s, url: 'https://evil.example/rules' })) })).toThrow()
  })
  it('분류·추가정보 불일치, 추가 임의 필드, 다인 입력·해외 출발 거부', async () => {
    const body = request([item()])
    expect((await post({ ...body, items: [{ ...body.items[0], details: emptyDetails('lighter') }] })).status).toBe(400)
    expect((await post({ ...body, passengers: 2 })).status).toBe(400)
    expect((await post({ ...body, departureCountry: 'JP' })).status).toBe(400)
    expect((await post({ ...body, items: [{ ...body.items[0], details: { ...body.items[0]!.details, approved: true } }] })).status).toBe(400)
  })
})
