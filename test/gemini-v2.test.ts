import { describe, expect, it, vi } from 'vitest'
import { createGeminiV2 } from '../netlify/functions/_lib/providers/gemini-v2.ts'
import { RecognizeRequestSchema } from '../contract/v2/schemas.ts'
import { recognizeDemo } from '../contract/v2/demo.ts'
import requests from '../contract/v2/fixtures/requests.json' with { type: 'json' }
import { createMockClient } from '../contract/v2/mock.ts'
import { applyCandidate } from '../contract/v2/apply-candidate.ts'
import { handleApi } from '../netlify/functions/_lib/api.ts'

const environment = { GEMINI_CALLS_ENABLED: 'true', GEMINI_API_KEY: 'test-only-not-a-real-key', GEMINI_MODEL: 'gemini-3.8-flash' }
const label = RecognizeRequestSchema.parse(requests.label), estimate = RecognizeRequestSchema.parse(requests.estimate)
function recognized(input = label) {
  const { meta: _meta, ...output } = recognizeDemo(input)
  return { ...output, warnings: [], imageQuality: output.imageQuality.map(quality => ({ ...quality, source: 'ai' as const })) }
}
const envelope = (value: unknown, sources: string[] = []) => Response.json({ status: 'completed', output_text: JSON.stringify(value), steps: [
  { type: 'google_search_result', result: [{ search_suggestions: '<div>검색 제안</div>' }] },
  { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(value), annotations: sources.map(url => ({ type: 'url_citation', url, title: '검증용 출처' })) }] },
] })
const lookupInput = { itemId: 'existing-item-1', categoryId: 'power-bank' as const, modelName: 'MODEL-TEST', brand: null }

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
    const request = vi.fn<typeof fetch>(async () => envelope(recognized()))
    const provider = createGeminiV2(environment, request)
    const output = await provider.recognize(label)
    expect(output.meta.isDemoRecognition).toBe(false)
    const [url, options] = request.mock.calls[0]!, body = JSON.parse(options!.body as string)
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions')
    expect(new Headers(options!.headers).get('x-goog-api-key')).toBe(environment.GEMINI_API_KEY)
    expect(body.store).toBe(false); expect(body.tools).toBeUndefined(); expect(body.input[1].type).toBe('image')
    expect(options!.signal).toBeDefined(); expect(request).toHaveBeenCalledTimes(1); expect('evaluate' in provider).toBe(false)
  })
  it('외형 추정 모드에서 수치·모델을 반환하면 거부', async () => {
    const output = recognized(estimate), entry = output.items[0]!
    entry.fields.wh = 10; entry.unreadFields = entry.unreadFields.filter(field => field !== 'wh')
    entry.fieldSources.wh = { source: 'label', imageId: entry.imageId, confirmed: false }
    await expect(createGeminiV2(environment, async () => envelope(output)).recognize(estimate)).rejects.toMatchObject({ code: 'RECOGNITION_FAILED' })
  })
  it('인용 출처가 있는 정확한 모델 후보만 제공, 라벨 보존·재확인', async () => {
    const sample = await createMockClient({ lookupScenario: 'candidate', delayMs: 0 }).lookup(lookupInput)
    const candidate = sample.candidates[0]!, url = candidate.sources[0]!.url
    const request = vi.fn<typeof fetch>(async () => envelope({ itemId: lookupInput.itemId, candidates: [candidate], message: '확인할 후보' }, [url]))
    const output = await createGeminiV2(environment, request).lookup(lookupInput)
    expect(output.meta.isDemoLookup).toBe(false); expect(output.searchSuggestions).toContain('검색 제안')
    const body = JSON.parse(request.mock.calls[0]![1]!.body as string)
    expect(body.tools).toEqual([{ type: 'google_search' }]); expect(body.input).not.toContain('base64')
    const entry = { ...recognizeDemo(label).items[0]!, confirmed: true, userEdited: false }
    const merged = applyCandidate(entry, output.candidates[0])
    expect(merged.fields.mah).toBe(1000); expect(merged.fields.wh).toBe(74)
    expect(merged.confirmed).toBe(false); expect(merged.fieldSources.wh).toMatchObject({ source: 'lookup', confirmed: false })
    expect(merged.fieldSources.volts!.source).toBe('label')
  })
  it('검색 인용 없는 URL·비슷한 다른 모델 후보 거부', async () => {
    const sample = await createMockClient({ lookupScenario: 'candidate', delayMs: 0 }).lookup(lookupInput), candidate = sample.candidates[0]!
    await expect(createGeminiV2(environment, async () => envelope({ itemId: lookupInput.itemId, candidates: [candidate], message: '후보' })).lookup(lookupInput)).rejects.toMatchObject({ code: 'PRODUCT_LOOKUP_FAILED' })
    candidate.fields.modelName = 'MODEL-TEST-PRO'
    await expect(createGeminiV2(environment, async () => envelope({ itemId: lookupInput.itemId, candidates: [candidate], message: '후보' }, [candidate.sources[0]!.url])).lookup(lookupInput)).rejects.toMatchObject({ code: 'PRODUCT_LOOKUP_FAILED' })
  })
  it('활성화한 API도 가짜 fetch로만 인식, 상류 한도 오류는 재시도 없이 공통 오류', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => envelope(recognized()))
    try {
      const response = await handleApi(new Request('https://api.example/api/v2/recognize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(label) }), { ...environment, USE_DEMO_RECOGNITION: 'false' })
      expect(response.status).toBe(200); expect((await response.json()).meta.isDemoRecognition).toBe(false)
    } finally { network.mockRestore() }
    const request = vi.fn<typeof fetch>(async () => new Response('private provider detail', { status: 429 }))
    await expect(createGeminiV2(environment, request).lookup(lookupInput)).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' })
    expect(request).toHaveBeenCalledTimes(1)
  })
})
