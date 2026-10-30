import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import * as s from '../contract/schemas.ts'
import { buildOpenApi } from '../contract/openapi.ts'
import { deriveAction } from '../contract/policy.ts'
import { createMockClient } from '../contract/mock.ts'
import { createApiClient } from '../contract/client.ts'
import { evaluateExample, recognitionExample, resultPreviews, errorExamples } from '../contract/examples.ts'
import { DEMO_AIRLINE_ID } from '../contract/constants.ts'
import { labels } from '../contract/labels.ts'
import evaluateRequest from '../contract/fixtures/evaluate-request.json' with { type: 'json' }
import productCandidate from '../contract/fixtures/product-candidate.json' with { type: 'json' }

describe('계약과 프론트 목업', () => {
  it('OpenAPI 산출물이 현재 스키마와 일치', async () => {
    expect(JSON.parse(await readFile(new URL('../contract/openapi.yaml', import.meta.url), 'utf8'))).toEqual(buildOpenApi())
    expect(Object.keys(buildOpenApi().paths)).toHaveLength(7)
  })
  it('JSON fixture 요청·응답과 의미 검증', () => {
    expect(s.RecognizeResponseSchema.safeParse(recognitionExample).success).toBe(true)
    expect(s.EvaluateRequestSchema.safeParse(evaluateExample).success).toBe(true)
    recognitionExample.items.forEach(s.assertItemSemantics)
    resultPreviews.forEach(p => expect(s.ItemResultSchema.safeParse(p.result).success).toBe(true))
    errorExamples.forEach(p => expect(s.ErrorResponseSchema.safeParse(p.body).success).toBe(true))
    expect(s.EvaluateRequestSchema.safeParse(evaluateRequest).success).toBe(true)
    expect(s.ResolveProductResponseSchema.safeParse(productCandidate).success).toBe(true)
    expect(new Set(resultPreviews.flatMap(p => [p.result.cabin.verdict, p.result.checked.verdict]))).toEqual(new Set(['ALLOWED', 'CONDITIONAL', 'PROHIBITED', 'NEEDS_INFO']))
  })
  it('고정 부정 안내는 보존하고 생성 판정 문구는 금지어 검사', () => {
    expect(labels.referenceNotice).toBe('이 화면은 물품 정보를 보여주는 참고용입니다. 공항 보안검색 통과나 반입 허가를 보장하지 않으며, 최종 판단은 항공사와 보안검색 직원의 기준을 따릅니다.')
    for (const { result } of resultPreviews) expect(`${result.cabin.reason} ${result.checked.reason} ${result.staffSummary}`).not.toMatch(/통과|허가|문제없음|보장/u)
  })
  it('인식 결과에서 모델 정보를 임의 생성하지 않음', () => {
    expect(recognitionExample.items.every(i => Object.values(i.fields).every(v => v === null))).toBe(true)
    expect(s.ItemInfoSchema.safeParse({ ...evaluateExample.items[0], invented: true }).success).toBe(false)
    expect(s.ItemInfoSchema.safeParse({ ...evaluateExample.items[0], confidence: 2 }).success).toBe(false)
  })
  it('정규화 bbox·unreadFields의 논리 오류 거부', () => {
    const item = structuredClone(recognitionExample.items[0]!)
    expect(() => s.assertItemSemantics({ ...item, bbox: [0.8, 0, 0.5, 0.1] })).toThrow()
    expect(() => s.assertItemSemantics({ ...item, unreadFields: [] })).toThrow()
  })
  it('기내·위탁별 필수 필드를 계약에 분리', async () => {
    const result = await createMockClient({ delayMs: 0 }).categories(DEMO_AIRLINE_ID)
    const bank = result.categories.find(c => c.id === 'power-bank')!
    expect(bank.requiredFields).toEqual({ cabin: ['wh'], checked: [] })
  })
  const verdicts = ['ALLOWED', 'CONDITIONAL', 'PROHIBITED', 'NEEDS_INFO'] as const
  const expected = [
    ['PUT_IN_CABIN','PUT_IN_CABIN','PUT_IN_CABIN','PUT_IN_CABIN'],
    ['PUT_IN_CHECKED','CHECK_CONDITIONS','CHECK_CONDITIONS','CHECK_CONDITIONS'],
    ['PUT_IN_CHECKED','CHECK_CONDITIONS','LEAVE_BEHIND','CHECK_CONDITIONS'],
    ['PUT_IN_CHECKED','CHECK_CONDITIONS','CHECK_CONDITIONS','CHECK_CONDITIONS'],
  ]
  verdicts.forEach((cabin, i) => verdicts.forEach((checked, j) => it(`권장 조치 ${cabin}/${checked}`, () => {
    expect(deriveAction(cabin, checked)).toBe(expected[i]![j])
  })))
  it('선택한 목업은 실서버 없이 동일 인터페이스로 동작', async () => {
    for (const scenario of ['needs-info','cabin','checked','conditional','prohibited','unknown'] as const) {
      const client = createMockClient({ scenario, delayMs: 0 })
      expect(s.MetaResponseSchema.safeParse(await client.meta()).success).toBe(true)
      const response = await client.evaluate(evaluateExample)
      expect(s.EvaluateResponseSchema.safeParse(response).success).toBe(true)
      expect(response.results.map(r => r.itemId)).toEqual(evaluateExample.items.map(i => i.id))
    }
  })
  it('목업 결과가 다른 호출에 의해 오염되지 않음', async () => {
    const client = createMockClient({ delayMs: 0 })
    const first = await client.evaluate(evaluateExample); first.results[0]!.cabin.reason = '수정'
    expect((await client.evaluate(evaluateExample)).results[0]!.cabin.reason).not.toBe('수정')
  })
  it('제품 후보 목업은 가상 출처와 사용자 확인 상태를 명시', async () => {
    const response = await createMockClient({ scenario: 'product-found', delayMs: 0 }).resolveProduct({ airlineId: DEMO_AIRLINE_ID, item: evaluateExample.items[0]! })
    expect(response.status).toBe('CANDIDATES_FOUND')
    expect(response.candidates[0]!.requiresConfirmation).toBe(true)
    expect(response.message).toContain('실제 제품 정보나 검색 결과가 아닙니다')
  })
  it('목업의 0건·오류·취소 처리', async () => {
    const image = { mimeType: 'image/png' as const, base64: 'iVBORw0KGgo=' }
    expect((await createMockClient({ scenario: 'empty', delayMs: 0 }).recognize({ airlineId: DEMO_AIRLINE_ID, image })).items).toEqual([])
    await expect(createMockClient({ scenario: 'error', delayMs: 0 }).evaluate(evaluateExample)).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    const controller = new AbortController()
    const waiting = createMockClient({ delayMs: 1000 }).health(controller.signal); controller.abort()
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('실제 클라이언트는 HTML·계약 불일치·구조화 오류를 구분', async () => {
    const fetch = (response: Response): typeof globalThis.fetch => async () => response
    await expect(createApiClient({ fetch: fetch(new Response('<html/>')) }).health()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    await expect(createApiClient({ fetch: fetch(Response.json({ ok: true })) }).health()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    await expect(createApiClient({ fetch: fetch(Response.json(errorExamples[0]!.body, { status: 400 })) }).health()).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400 })
  })
  it('실서버·목업의 클라이언트 입력 오류는 동일한 Promise 거부', async () => {
    const body = { ...evaluateExample, items: [] }
    await expect(createApiClient().evaluate(body)).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 0 })
    await expect(createMockClient().evaluate(body)).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 0 })
    await expect(createMockClient().categories('missing')).rejects.toMatchObject({ code: 'UNKNOWN_AIRLINE', status: 404 })
  })
})
