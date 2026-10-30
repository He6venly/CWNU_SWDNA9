import { describe, expect, it, vi } from 'vitest'
import { createGeminiProvider } from '../netlify/functions/_lib/providers/gemini.ts'
import type { RuleEvidence } from '../netlify/functions/_lib/providers/gemini.ts'
import { evaluateExample, recognitionExample, resultPreviews } from '../contract/examples.ts'
import { demoMeta } from '../contract/data.ts'

const settings = { apiKey: 'test-only-not-a-real-key', model: 'test-model' }
const image = { mimeType: 'image/png' as const, base64: 'iVBORw0KGgo=' }
const rules: RuleEvidence = {
  airlineId: 'demo-airline', isDemo: true, sourceUrl: 'https://example.invalid/demo-rule', updatedAt: '2026-10-30', content: '시연용 규정. 실제 항공사 규정이 아님.',
  requirements: { 'power-bank': { cabin: { requiredFields: ['wh'], alwaysProhibited: false }, checked: { requiredFields: [], alwaysProhibited: true } } },
}
function response(value: unknown) { return Response.json({ status: 'completed', output_text: JSON.stringify(value), steps: [] }) }
describe('Gemini 어댑터 — 실제 API 호출 없음', () => {
  it('서버 헤더 키, stateless 요청, 이미지 추출 스키마 검증', async () => {
    const request = vi.fn<typeof fetch>(async () => response({ items: recognitionExample.items }))
    const result = await createGeminiProvider(settings, request).recognize({ airlineId: 'demo-airline', image })
    expect(result.meta).toEqual({ ...demoMeta, isDemoRecognition: false })
    const [url, options] = request.mock.calls[0]!
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions')
    expect(new Headers(options?.headers).get('x-goog-api-key')).toBe(settings.apiKey)
    const body = JSON.parse(options?.body as string)
    expect(body.store).toBe(false); expect(body.tools).toBeUndefined()
    expect(body.input[1]).toMatchObject({ type: 'image', data: image.base64 })
    expect(options?.signal).toBeDefined()
  })
  it('설정 불완전 시 차단', () => {
    expect(() => createGeminiProvider({ ...settings, apiKey: '' })).toThrow()
    expect(() => createGeminiProvider({ ...settings, model: '../fake' })).toThrow()
  })
  it('스키마 위반·불명확 정보의 필드 불일치 거부', async () => {
    const item = { ...recognitionExample.items[0], unreadFields: [] }
    const provider = createGeminiProvider(settings, async () => response({ items: [item] }))
    await expect(provider.recognize({ airlineId: 'demo-airline', image })).rejects.toMatchObject({ code: 'RECOGNITION_FAILED' })
  })
  it('모델명 없으면 제품 검색 호출하지 않음', async () => {
    const request = vi.fn<typeof fetch>()
    const result = await createGeminiProvider(settings, request).resolveProduct({ airlineId: 'demo-airline', item: evaluateExample.items[0]! })
    expect(result.status).toBe('NEEDS_INFO'); expect(request).not.toHaveBeenCalled()
  })
  it('검색 출처 없는 제품 후보는 거부', async () => {
    const item = structuredClone(evaluateExample.items[0]!); item.fields.modelName = 'TEST-1'; item.unreadFields = item.unreadFields.filter(f => f !== 'modelName')
    const candidate = { id: 'candidate-1', itemId: item.id, name: item.name, fields: item.fields, requiresConfirmation: true, sources: [{ title: '가짜', url: 'https://example.invalid/fake', retrievedAt: '2026-10-30T00:00:00.000Z' }] }
    const provider = createGeminiProvider(settings, async () => response({ itemId: item.id, status: 'CANDIDATES_FOUND', candidates: [candidate], missingFields: [], message: '검색 후보' }))
    await expect(provider.resolveProduct({ airlineId: 'demo-airline', item })).rejects.toMatchObject({ code: 'PRODUCT_LOOKUP_FAILED' })
  })
  it('제품 검색은 텍스트와 grounding만 사용하며 사진 재전송하지 않음', async () => {
    const item = structuredClone(evaluateExample.items[0]!); item.fields.modelName = 'TEST-1'
    const request = vi.fn<typeof fetch>(async () => response({ itemId: item.id, status: 'NOT_FOUND', candidates: [], missingFields: [], message: '조회 결과 없음' }))
    await createGeminiProvider(settings, request).resolveProduct({ airlineId: 'demo-airline', item })
    const body = JSON.parse(request.mock.calls[0]![1]?.body as string)
    expect(body.tools).toEqual([{ type: 'google_search' }]); expect(body.input).not.toContain('base64')
  })
  it('필드 누락이 독립적으로 확정된 위탁 불가를 덮지 않음', async () => {
    const item = evaluateExample.items[0]!
    const request = vi.fn<typeof fetch>(async () => response({ results: [{ ...resultPreviews.find(p => p.id === 'cabin')!.result, itemId: item.id }] }))
    const result = await createGeminiProvider(settings, request).evaluate({ airlineId: 'demo-airline', items: [item] }, rules)
    expect(result.results[0]).toMatchObject({ cabin: { verdict: 'NEEDS_INFO' }, checked: { verdict: 'PROHIBITED' }, missingFields: ['wh'], action: 'CHECK_CONDITIONS', isDemo: true })
    expect(result.results[0]!.staffSummary).toContain('사용자 확인 전')
    expect(result.meta.isDemoRules).toBe(true)
  })
  it('규칙 없는 카테고리를 AI가 가능이라고 해도 NEEDS_INFO', async () => {
    const item = evaluateExample.items[3]!
    const provider = createGeminiProvider(settings, async () => response({ results: [{ ...resultPreviews[1]!.result, itemId: item.id }] }))
    const result = await provider.evaluate({ airlineId: 'demo-airline', items: [item] }, rules)
    expect(result.results[0]!.cabin.verdict).toBe('NEEDS_INFO'); expect(result.results[0]!.checked.verdict).toBe('NEEDS_INFO')
  })
  it('AI의 ID 누락·중복 및 보장 표현 거부', async () => {
    const request = { airlineId: 'demo-airline', items: [evaluateExample.items[0]!] }
    const provider = createGeminiProvider(settings, async () => response({ results: [{ ...resultPreviews[1]!.result, itemId: 'wrong-id' }] }))
    await expect(provider.evaluate(request, rules)).rejects.toMatchObject({ code: 'EVALUATION_FAILED' })
    const unsafe = createGeminiProvider(settings, async () => response({ results: [{ ...resultPreviews[1]!.result, staffSummary: '통과 보장' }] }))
    await expect(unsafe.evaluate(request, rules)).rejects.toMatchObject({ code: 'EVALUATION_FAILED' })
  })
  it('상류 오류·요청 제한의 내부 응답을 노출하지 않음', async () => {
    const provider = createGeminiProvider(settings, async () => new Response('secret provider error', { status: 500 }))
    await expect(provider.recognize({ airlineId: 'demo-airline', image })).rejects.toMatchObject({ code: 'RECOGNITION_FAILED', message: 'AI 응답을 확인하지 못했습니다.' })
    const limited = createGeminiProvider(settings, async () => new Response('', { status: 429 }))
    await expect(limited.recognize({ airlineId: 'demo-airline', image })).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
  it('타임아웃 시 자동 재시도하지 않음', async () => {
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    try {
      const request = vi.fn<typeof fetch>(async (_, init) => new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      }))
      const result = createGeminiProvider(settings, request).recognize({ airlineId: 'demo-airline', image }).catch(error => error)
      controller.abort()
      expect(await result).toMatchObject({ code: 'UPSTREAM_TIMEOUT' })
      expect(request).toHaveBeenCalledTimes(1)
    } finally { timeout.mockRestore() }
  })
})
