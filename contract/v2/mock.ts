import { createApiClient } from './client.ts'
import { API_PREFIX } from './constants.ts'
import { demoAirlines, demoCategories, demoMeta, demoMetadata, evaluateStub, lookupStub, recognizeDemo } from './demo.ts'
import type { RecognitionScenario } from './demo.ts'
import * as s from './schemas.ts'
import ruleExample from './fixtures/rules.json' with { type: 'json' }
import { condition } from './presentation.ts'

export function createMockClient({ scenario = 'standard', delayMs = 200, lookupScenario = 'empty', resultScenario = 'stub' }: { scenario?: RecognitionScenario; delayMs?: number; lookupScenario?: 'empty' | 'candidate'; resultScenario?: 'stub' | 'battery-conditional' } = {}) {
  const mockFetch: typeof fetch = async (url, init) => {
    const request = new Request(url, init)
    const signal = request.signal
    signal.throwIfAborted()
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason) }
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, delayMs)
      signal.addEventListener('abort', abort, { once: true })
    })
    const path = new URL(request.url).pathname.slice(API_PREFIX.length + 1)
    const params = new URL(request.url).searchParams
    const airlineId = params.get('airlineId') ?? ''
    const ensureAirline = (id: string) => {
      const entry = demoAirlines.find(a => a.id === id)
      if (!entry) return Response.json({ error: { code: 'UNKNOWN_AIRLINE', message: '항공사 정보를 찾을 수 없습니다.' } }, { status: 404 })
      if (!entry.enabled) return Response.json({ error: { code: 'AIRLINE_NOT_ENABLED', message: '해당 항공사는 규정 연결 준비 중입니다.' } }, { status: 409 })
    }
    switch (path) {
      case 'health': return Response.json({ ok: true, time: new Date().toISOString(), meta: demoMeta })
      case 'meta': return Response.json(demoMetadata)
      case 'rules': return airlineId === 'korean-air' ? Response.json(ruleExample) : Response.json({ error: { code: 'NOT_FOUND', message: '규정 목업이 없습니다.' } }, { status: 404 })
      case 'airlines': return Response.json({ airlines: demoAirlines, meta: demoMeta })
      case 'categories': return ensureAirline(airlineId) ?? Response.json({ airlineId, flightType: params.get('flightType'), departureCountry: params.get('departureCountry'), categories: demoCategories, meta: demoMeta })
      case 'recognize': return Response.json(recognizeDemo(s.RecognizeRequestSchema.parse(await request.json()), scenario))
      case 'lookup': {
        const input = s.LookupRequestSchema.parse(await request.json()), output = lookupStub(input)
        if (lookupScenario === 'candidate') {
          output.message = '실제 제품과 무관한 목업 후보입니다. 적용·재확인 화면 개발용입니다.'
          output.candidates = [{ id: 'mock-product', itemId: input.itemId, name: '시연 제품 후보', confidence: 0.5, requiresConfirmation: true,
            fields: { brand: input.brand, modelName: input.modelName, wh: 74, mah: 20000, volts: 3.7, ml: null, count: null },
            sources: [{ title: '시연 가상 출처 (실제 사양 아님)', url: 'https://example.invalid/mock-product', retrievedAt: '2026-10-30T00:00:00Z' }],
          }]
        }
        return Response.json(s.LookupResponseSchema.parse(output))
      }
      case 'evaluate': {
        const input = s.EvaluateRequestSchema.parse(await request.json())
        s.assertEvaluationItems(input.items)
        const failure = ensureAirline(input.airlineId)
        if (failure) return failure
        const output = evaluateStub(input)
        if (resultScenario === 'battery-conditional') for (const result of output.results) {
          if (input.items.find(item => item.id === result.itemId)?.categoryId !== 'power-bank') continue
          result.cabin = { verdict: 'CONDITIONAL', reason: '시연: 항공사 승인과 단락 방지 조건을 보여주는 고정 예시입니다.' }
          result.checked = { verdict: 'PROHIBITED', reason: '시연: 위탁 금지 표시 예시입니다.' }
          result.staffSummary = '시연용 조건부 가능 카드입니다. 실제 규정 판정이 아닙니다.'
          if (result.presentation) { result.presentation.conditions = [condition('AIRLINE_APPROVAL', 'cabin'), condition('INSULATE_TERMINALS', 'cabin')]; result.presentation.airlineApproval = 'required' }
        }
        return Response.json(output)
      }
      default: return Response.json({ error: { code: 'NOT_FOUND', message: 'API 경로를 찾을 수 없습니다.' } }, { status: 404 })
    }
  }
  return createApiClient({ baseUrl: 'https://mock.invalid', fetch: mockFetch })
}
