import { readFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import requests from '../contract/v2/fixtures/requests.json' with { type: 'json' }
import fixtureItems from '../contract/v2/fixtures/items.json' with { type: 'json' }
import examples from '../contract/v2/fixtures/responses.json' with { type: 'json' }
import { createApiClient, ApiError } from '../contract/v2/client.ts'
import { createApiClient as createLegacyClient } from '../contract/client.ts'
import { createMockClient } from '../contract/v2/mock.ts'
import { recognizeDemo, demoMeta, demoMetadata } from '../contract/v2/demo.ts'
import type { RecognitionScenario } from '../contract/v2/demo.ts'
import { buildOpenApi } from '../contract/v2/openapi.ts'
import * as s from '../contract/v2/schemas.ts'
import { LIMITS } from '../contract/v2/constants.ts'
import { handleApi } from '../netlify/functions/_lib/api.ts'

const overview = s.RecognizeRequestSchema.parse(requests.overview)
const label = s.RecognizeRequestSchema.parse(requests.label)
const estimate = s.RecognizeRequestSchema.parse(requests.estimate)
const actual = createApiClient({ baseUrl: 'https://api.example', fetch: async (url, init) => handleApi(new Request(url, init), {}) })
const itemInfo = () => ({ ...s.DetectedItemSchema.parse(fixtureItems.label), confirmed: false, userEdited: false })
const evaluateBody = () => ({ airlineId: 'demo-airline', flightType: 'domestic' as const, departureCountry: 'KR' as const, items: [itemInfo()] })
const post = (operation: string, body: unknown, headers?: HeadersInit) => handleApi(new Request(`https://api.example/api/v2/${operation}`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } }), {})
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-31T09:00:00Z')) })
afterEach(() => vi.useRealTimers())

describe('2.0 계약과 버전 공존', () => {
  it('v1과 v2 실제 클라이언트가 서로 다른 메타 계약으로 동작', async () => {
    const legacy = createLegacyClient({ baseUrl: 'https://api.example', fetch: async (url, init) => handleApi(new Request(url, init), {}) })
    expect((await legacy.health()).meta.contractVersion).toBe('1.0.0')
    expect((await actual.health()).meta).toEqual({ ...demoMeta, isDemoRules: false })
    expect((await actual.meta()).capabilities.evaluation).toBe('rules')
    expect((await actual.meta()).supportedFlightTypes).toEqual(['domestic', 'international'])
    const airline = (await actual.airlines()).airlines.find(a => a.id === 'korean-air')!
    expect(airline.enabled).toBe(true); expect(airline.isDemo).toBe(false)
  })
  it('OpenAPI 파일·요청/응답 스키마·노선 쿼리 기준 일치', async () => {
    const spec = buildOpenApi()
    expect(JSON.parse(await readFile(new URL('../contract/v2/openapi.yaml', import.meta.url), 'utf8'))).toEqual(spec)
    expect(Object.keys(spec.paths)).toHaveLength(8)
    const category = spec.paths['/api/v2/categories'] as { get: { parameters: Array<{ name: string; required: boolean }> } }
    expect(category.get.parameters.map(p => p.name)).toEqual(['airlineId', 'flightType', 'departureCountry'])
    expect(category.get.parameters.every(p => p.required)).toBe(true)
  })
  it('원문 JSON fixture 구조·의미 제약 검사', () => {
    Object.values(requests).forEach(value => s.assertRecognizeRequest(s.RecognizeRequestSchema.parse(value)))
    Object.values(fixtureItems).forEach(value => s.assertItemSemantics(s.DetectedItemSchema.parse(value)))
    expect(s.MetaResponseSchema.safeParse(demoMetadata).success).toBe(true)
  })
  it('배포용 요청/응답 예시 9개 모두 구조·연결 관계 검증', () => {
    expect(Object.keys(examples)).toHaveLength(9)
    for (const example of Object.values(examples)) {
      const input = s.RecognizeRequestSchema.parse(example.request)
      const output = s.RecognizeResponseSchema.parse(example.response)
      s.assertRecognizeRequest(input); s.assertRecognizeResponse(input, output)
    }
    expect(examples.overview.response.items).toHaveLength(2)
    expect(examples.label.response.items).toHaveLength(1)
    expect(examples.empty.response.items).toEqual([])
  })
  it('출처 설명 길이는 모델명 120자와 독립적으로 허용', () => {
    const item = s.DetectedItemSchema.parse(fixtureItems.estimate)
    item.estimate!.basis = '가'.repeat(200)
    expect(s.DetectedItemSchema.safeParse(item).success).toBe(true)
    item.estimate!.basis = '가'.repeat(401)
    expect(s.DetectedItemSchema.safeParse(item).success).toBe(false)
  })
  it('인식에 항공사 없이 전체 다건·개별 단건 지원', async () => {
    const many = await actual.recognize(overview), one = await actual.recognize(label)
    expect(many.items).toHaveLength(2); expect(many.multipleItemsDetected).toBe(true); expect(many.suggestRetake).toBe(false)
    expect(one.items).toHaveLength(1); expect(one.items[0]!.id).toBe('existing-item-1')
    expect(one.items[0]!.identification).toBe('label_read')
    expect(one.imageQuality[0]).toMatchObject({ source: 'demo', usable: null })
    expect(one.items[0]!.fieldSources.volts).toMatchObject({ source: 'label', voltageType: 'nominal' })
  })
  it.each(['domestic', 'international'] as const)('노선 선택 %s 전달·반환', async flightType => {
    expect((await actual.categories('demo-airline', flightType)).flightType).toBe(flightType)
    const response = await actual.evaluate({ ...evaluateBody(), flightType })
    expect(response.flightType).toBe(flightType); expect(response.ruleVersion).toBeNull()
    expect(response.results[0]).toMatchObject({ cabin: { verdict: 'NEEDS_INFO' }, checked: { verdict: 'NEEDS_INFO' }, derivedFields: {} })
    expect(response.results[0]!.staffSummary).toContain(flightType === 'domestic' ? '국내선' : '국제선')
  })
  it('제품 조회는 후보 없음도 정상 응답이며 demoLookup 표시', async () => {
    const output = await actual.lookup({ itemId: 'item-1', categoryId: 'power-bank', modelName: 'DEMO', brand: null })
    expect(output.candidates).toEqual([]); expect(output.meta.isDemoLookup).toBe(true)
  })
})

describe('2.0 목업의 인식 시나리오', () => {
  const cases: Array<{ scenario: RecognitionScenario; input: typeof label; count: number; warning?: string; retake?: boolean }> = [
    { scenario: 'standard', input: label, count: 1 }, { scenario: 'empty', input: label, count: 0, warning: 'NO_ITEM_DETECTED', retake: true },
    { scenario: 'multiple', input: label, count: 0, warning: 'MULTIPLE_ITEMS', retake: true },
    { scenario: 'no-label', input: label, count: 0, warning: 'NO_LABEL_FOUND', retake: true },
    { scenario: 'blur', input: label, count: 0, warning: 'POOR_IMAGE', retake: true },
    { scenario: 'risk-estimate', input: estimate, count: 1 }, { scenario: 'low-confidence', input: estimate, count: 1 },
  ]
  it.each(cases)('$scenario: $count개', async ({ scenario, input, count, warning, retake }) => {
    const output = await createMockClient({ scenario, delayMs: 0 }).recognize(input)
    expect(output.items).toHaveLength(count); expect(output.suggestRetake).toBe(retake ?? false)
    if (warning) expect(output.warnings.some(w => w.code === warning)).toBe(true)
    if (scenario === 'no-label') expect(output.suggestEstimateMode).toBe(true)
    if (scenario === 'risk-estimate') expect(Object.values(output.items[0]!.fields).every(v => v === null)).toBe(true)
    if (scenario === 'low-confidence') expect(output.items[0]!.confidence).toBe(0.4)
    expect(output.meta.isDemoRecognition).toBe(true)
  })
  it('모의 지연 중 취소하면 응답을 적용하지 않음', async () => {
    const controller = new AbortController()
    const pending = createMockClient({ delayMs: 1000 }).recognize(overview, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('실제 스텁 경로에는 목업 시나리오 숨은 파라미터 없음', async () => {
    const response = await post('recognize', { ...requests.label, scenario: 'blur' })
    expect(response.status).toBe(400)
  })
})

describe('2.0 잘못된 입력·출처·상태 연결 거부', () => {
  const invalidInputs = [
    { ...requests.overview, images: [] },
    { ...requests.overview, mode: 'estimate' },
    { ...requests.overview, images: [...requests.overview.images, ...requests.overview.images] },
    { ...requests.label, images: requests.overview.images },
    { ...requests.label, images: requests.estimate.images },
    { ...requests.estimate, images: requests.label.images },
    { ...requests.label, images: Array(4).fill(requests.label.images[0]) },
    { ...requests.label, images: [requests.label.images[0], requests.label.images[0]] },
    { ...requests.label, images: [{ ...requests.label.images[0], mimeType: 'image/jpeg' }] },
  ]
  it.each(invalidInputs.map((body, index) => ({ body, index })))('사진 모드·개수·ID·MIME 오류 $index', async ({ body }) => {
    expect((await post('recognize', body)).status).toBe(400)
  })
  it('필드 값·출처·읽지 못한 필드·전압 종류 관계 검증', async () => {
    const missing = itemInfo(); delete missing.fieldSources.volts
    expect((await post('evaluate', { ...evaluateBody(), items: [missing] })).status).toBe(400)
    const unread = itemInfo(); unread.unreadFields = []
    expect((await post('evaluate', { ...evaluateBody(), items: [unread] })).status).toBe(400)
    const lookup = itemInfo(); lookup.fieldSources.mah = { source: 'lookup', confirmed: false }
    expect((await post('evaluate', { ...evaluateBody(), items: [lookup] })).status).toBe(400)
    const calc = itemInfo(); calc.fields.wh = 3.7; calc.unreadFields = calc.unreadFields.filter(f => f !== 'wh')
    calc.fieldSources.wh = { source: 'calculated', confirmed: false, basis: 'mah*volts/1000' }
    s.assertItemSemantics(calc)
    calc.fieldSources.volts!.voltageType = 'output'
    expect((await post('evaluate', { ...evaluateBody(), items: [calc] })).status).toBe(400)
    calc.fieldSources.volts!.voltageType = 'nominal'; calc.fields.wh = 4
    expect((await post('evaluate', { ...evaluateBody(), items: [calc] })).status).toBe(400)
  })
  it('노선 누락·잘못된 값·중복 물품·실항공사 준비 상태 검증', async () => {
    const { flightType: _flightType, ...missing } = evaluateBody()
    expect((await post('evaluate', missing)).status).toBe(400)
    expect((await post('evaluate', { ...evaluateBody(), flightType: 'invalid' })).status).toBe(400)
    expect((await post('evaluate', { ...evaluateBody(), departureCountry: 'JP' })).status).toBe(400)
    expect((await post('evaluate', { ...evaluateBody(), items: [itemInfo(), itemInfo()] })).status).toBe(400)
    const actualRules = await post('evaluate', { ...evaluateBody(), airlineId: 'korean-air' })
    expect(actualRules.status).toBe(200)
    expect((await actualRules.json()).results[0].cabin.verdict).toBe('NEEDS_INFO')
  })
  it('잘못된 서버 결과 ID·사진 연결을 클라이언트도 거부', async () => {
    const response = recognizeDemo(label)
    response.items[0]!.imageId = 'wrong-image'
    const client = createApiClient({ baseUrl: 'https://api.example', fetch: async () => Response.json(response) })
    await expect(client.recognize(label)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    const badDetail = recognizeDemo(label)
    badDetail.items.push(structuredClone(badDetail.items[0]!))
    expect(() => s.assertRecognizeResponse(label, badDetail)).toThrow()
  })
  it('요청 크기·알 수 없는 경로·CORS·메서드 보호 유지', async () => {
    const large = await post('recognize', {}, { 'Content-Length': String(LIMITS.requestBytes + 1) })
    expect(large.status).toBe(413)
    expect((await handleApi(new Request('https://api.example/api/v2/unknown'), {})).status).toBe(404)
    expect((await handleApi(new Request('https://api.example/api/v2/health', { headers: { Origin: 'https://evil.example' } }), {})).status).toBe(403)
    expect((await post('health', {})).status).toBe(405)
    const options = await handleApi(new Request('https://api.example/api/v2/recognize', { method: 'OPTIONS', headers: { Origin: 'https://front.example', 'Access-Control-Request-Method': 'POST' } }), { ALLOWED_ORIGINS: 'https://front.example' })
    expect(options.status).toBe(204)
  })
  it('실제 공급자 미연결 시 외부 호출 없이 503', async () => {
    const network = vi.spyOn(globalThis, 'fetch')
    try {
      const response = await handleApi(new Request('https://api.example/api/v2/recognize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requests.overview) }), { USE_DEMO_RECOGNITION: 'false' })
      expect(response.status).toBe(503); expect(network).not.toHaveBeenCalled()
    } finally { network.mockRestore() }
  })
  it('클라이언트 로컬 오류는 ApiError이며 아직 HTTP 요청 안 함', async () => {
    const request = vi.fn<typeof fetch>()
    const client = createApiClient({ fetch: request })
    await expect(client.recognize({ ...overview, images: [] })).rejects.toBeInstanceOf(ApiError)
    expect(request).not.toHaveBeenCalled()
  })
  it('3장 사진의 base64 합계가 4MiB를 넘으면 네트워크 전에 거부', async () => {
    const request = vi.fn<typeof fetch>()
    const base64 = Buffer.alloc(1024 * 1024).toString('base64')
    const input = s.RecognizeRequestSchema.parse({
      captureMode: 'detail', mode: 'label', images: [1, 2, 3].map(n => ({ id: `image-${n}`, kind: 'label', mimeType: 'image/png', base64 })),
    })
    await expect(createApiClient({ fetch: request }).recognize(input)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE', status: 0 })
    expect(request).not.toHaveBeenCalled()
  })
})
