import { createApiClient } from './client.ts'
import { API_PREFIX } from './constants.ts'
import { demoAirlines, demoCategories, demoMeta, demoMetadata, evaluateStub, lookupStub, recognizeDemo } from './demo.ts'
import type { RecognitionScenario } from './demo.ts'
import * as s from './schemas.ts'

export function createMockClient({ scenario = 'standard', delayMs = 200 }: { scenario?: RecognitionScenario; delayMs?: number } = {}) {
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
      case 'airlines': return Response.json({ airlines: demoAirlines, meta: demoMeta })
      case 'categories': return ensureAirline(airlineId) ?? Response.json({ airlineId, flightType: params.get('flightType'), departureCountry: params.get('departureCountry'), categories: demoCategories, meta: demoMeta })
      case 'recognize': return Response.json(recognizeDemo(s.RecognizeRequestSchema.parse(await request.json()), scenario))
      case 'lookup': return Response.json(lookupStub(s.LookupRequestSchema.parse(await request.json())))
      case 'evaluate': {
        const input = s.EvaluateRequestSchema.parse(await request.json())
        return ensureAirline(input.airlineId) ?? Response.json(evaluateStub(input))
      }
      default: return Response.json({ error: { code: 'NOT_FOUND', message: 'API 경로를 찾을 수 없습니다.' } }, { status: 404 })
    }
  }
  return createApiClient({ baseUrl: 'https://mock.invalid', fetch: mockFetch })
}
