import { describe, expect, it, vi } from 'vitest'
import { createGeminiV2 } from '../netlify/functions/_lib/providers/gemini-v2.ts'
import { RecognizeRequestSchema } from '../contract/v2/schemas.ts'
import { recognizeDemo } from '../contract/v2/demo.ts'
import requests from '../contract/v2/fixtures/requests.json' with { type: 'json' }
import { applyCandidate } from '../contract/v2/apply-candidate.ts'
import { handleApi } from '../netlify/functions/_lib/api.ts'

const environment = { GEMINI_CALLS_ENABLED: 'true', GEMINI_API_KEY: 'test-only-not-a-real-key', GEMINI_MODEL: 'gemini-3.6-flash', TAVILY_API_KEY: 'tvly-test-only-not-a-real-key' }
const label = RecognizeRequestSchema.parse(requests.label), estimate = RecognizeRequestSchema.parse(requests.estimate)
function recognized(input = label) {
  const { meta: _meta, ...output } = recognizeDemo(input)
  return { ...output, warnings: [], imageQuality: output.imageQuality.map(quality => ({ ...quality, source: 'ai' as const })) }
}
const envelope = (value: unknown, sources: string[] = []) => {
  return Response.json({ status: 'completed', output_text: JSON.stringify(value), steps: [
  { type: 'google_search_result', result: [{ search_suggestions: '<div>검색 제안</div>' }] },
  { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(value), annotations: sources.map(url => ({ type: 'url_citation', url, title: '검증용 출처' })) }] },
] }) }
function providerRecognized(input = label) {
  const output = recognized(input)
  return { items: output.items.map(item => input.captureMode === 'detail' && input.mode === 'label'
    ? { name: item.name, categoryId: item.categoryId, brand: item.fields.brand, modelName: item.fields.modelName,
      wh: item.fields.wh, mah: item.fields.mah, nominalVolts: item.fields.volts, ml: item.fields.ml }
    : { name: item.name, categoryId: item.categoryId }) }
}
const lookupInput = { itemId: 'existing-item-1', categoryId: 'power-bank' as const, modelName: 'MODEL-TEST', brand: null }
const searchEnvelope = (urls: string[], content = 'MODEL-TEST 제품 사양', title = 'MODEL-TEST 검증용 출처') => Response.json({ results: urls.map(url => ({ title, url, content, score: 0.9 })) })
function lookupFetch(urls: string[], content?: string, title?: string) { return vi.fn<typeof fetch>(async () => searchEnvelope(urls, content, title)) }

describe('Gemini 2.0 연결 — 전부 가짜 fetch, 실제 호출 없음', () => {
  it('키만 있어도 잠금 유지, API 기본·잠금 상태는 외부 호출 없음', async () => {
    const network = vi.spyOn(globalThis, 'fetch')
    try {
      const provider = createGeminiV2({ ...environment, GEMINI_CALLS_ENABLED: 'false' }, network)
      await expect(provider.recognize(label)).rejects.toMatchObject({ status: 503 })
      const response = await handleApi(new Request('https://api.example/api/v2/recognize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(label) }), { ...environment, USE_DEMO_RECOGNITION: 'false', GEMINI_CALLS_ENABLED: 'false' })
      expect(response.status).toBe(503); expect(network).not.toHaveBeenCalled()
    } finally { network.mockRestore() }
  })
  it('다중 이미지·사용자 취소 신호·저장 안 함·호출 1회, 판정 메서드 없음', async () => {
    const request = vi.fn<typeof fetch>(async () => envelope(providerRecognized()))
    const provider = createGeminiV2(environment, request)
    const output = await provider.recognize(label)
    expect(output.meta.isDemoRecognition).toBe(false)
    const [url, options] = request.mock.calls[0]!, body = JSON.parse(options!.body as string)
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions')
    expect(new Headers(options!.headers).get('x-goog-api-key')).toBe(environment.GEMINI_API_KEY)
    expect(body.store).toBe(false); expect(body.tools).toBeUndefined(); expect(body.input[1].type).toBe('image')
    expect(options!.signal).toBeDefined(); expect(request).toHaveBeenCalledTimes(1); expect('evaluate' in provider).toBe(false)
    expect(body.response_format).toMatchObject({ type: 'text', mime_type: 'application/json' })
    const itemSchema = body.response_format.schema.properties.items.items
    expect(itemSchema.properties.nominalVolts).toBeDefined()
    expect(itemSchema.properties.fields).toBeUndefined()
  })
  it('외형 추정 모드에서 수치·모델을 반환하면 거부', async () => {
    const output = providerRecognized(estimate)
    const recognizedOutput = await createGeminiV2(environment, async () => envelope(output)).recognize(estimate)
    expect(recognizedOutput.items[0]!.fields.wh).toBeNull()
    expect(recognizedOutput.items[0]!.identification).toBe('ai_estimated')
  })
  it('인용 출처가 있는 정확한 모델 후보만 제공, 라벨 보존·재확인', async () => {
    const url = 'https://example.com/products/model-test'
    const request = lookupFetch([url], 'MODEL-TEST battery capacity 1000 mAh. Rated capacity 74 Wh.')
    const output = await createGeminiV2(environment, request).lookup(lookupInput)
    expect(output.meta.isDemoLookup).toBe(false); expect(output.searchSuggestions).toBeUndefined()
    const [searchUrl, searchOptions] = request.mock.calls[0]!, body = JSON.parse(searchOptions!.body as string)
    expect(searchUrl).toBe('https://api.tavily.com/search')
    expect(new Headers(searchOptions!.headers).get('Authorization')).toBe(`Bearer ${environment.TAVILY_API_KEY}`)
    expect(body).toMatchObject({ search_depth: 'basic', max_results: 5, include_answer: false, include_raw_content: false })
    expect(body.query).toContain('MODEL-TEST'); expect(JSON.stringify(body)).not.toContain('base64')
    expect(request).toHaveBeenCalledTimes(1)
    const entry = { ...recognizeDemo(label).items[0]!, confirmed: true, userEdited: false }
    const merged = applyCandidate(entry, output.candidates[0])
    expect(merged.fields.mah).toBe(1000); expect(merged.fields.wh).toBe(74)
    expect(merged.confirmed).toBe(false); expect(merged.fieldSources.wh).toMatchObject({ source: 'lookup', confirmed: false })
    expect(merged.fieldSources.volts!.source).toBe('label')
  })
  it('검색 인용 없는 URL·비슷한 다른 모델 후보 거부', async () => {
    const failed = await createGeminiV2(environment, lookupFetch([])).lookup(lookupInput)
    expect(failed.candidates).toEqual([]); expect(failed.message).toContain('직접 입력')
    const output = await createGeminiV2(environment, lookupFetch(['https://example.com/products/model-test-pro'], 'MODEL-TEST-PRO 제품 사양', 'MODEL-TEST-PRO 검증용 출처')).lookup(lookupInput)
    expect(output.candidates).toEqual([])
  })
  it('제품 조회는 Gemini 키·모델 없이 Tavily만 사용', async () => {
    const request = lookupFetch(['https://example.com/products/model-test'])
    const output = await createGeminiV2({ GEMINI_CALLS_ENABLED: 'true', TAVILY_API_KEY: environment.TAVILY_API_KEY }, request).lookup(lookupInput)
    expect(output.candidates).toHaveLength(1); expect(request).toHaveBeenCalledTimes(1)
  })
  it('활성화한 API도 가짜 fetch로만 인식, 검색 한도 오류는 재시도 없이 수동 입력으로 계속', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => envelope(providerRecognized()))
    try {
      const response = await handleApi(new Request('https://api.example/api/v2/recognize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(label) }), { ...environment, USE_DEMO_RECOGNITION: 'false' })
      expect(response.status).toBe(200); expect((await response.json()).meta.isDemoRecognition).toBe(false)
    } finally { network.mockRestore() }
    const request = vi.fn<typeof fetch>(async () => new Response('private provider detail', { status: 429 }))
    const fallback = await createGeminiV2(environment, request).lookup(lookupInput)
    expect(fallback.candidates).toEqual([]); expect(fallback.message).toContain('라벨 값을 확인하거나 직접 입력')
    expect(request).toHaveBeenCalledTimes(1)
  })
})
