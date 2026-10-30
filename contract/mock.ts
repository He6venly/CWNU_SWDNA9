import { ApiError, parseRequest } from './client.ts'
import type { ApiClient } from './client.ts'
import { demoAirlines, demoCategories, demoMeta, demoMetadata } from './data.ts'
import { emptyRecognitionExample, recognitionExample, resultPreviews } from './examples.ts'
import { EvaluateRequestSchema, RecognizeRequestSchema, ResolveProductRequestSchema, ResolveProductResponseSchema } from './schemas.ts'
import productCandidate from './fixtures/product-candidate.json' with { type: 'json' }

type MockScenario = 'needs-info' | 'cabin' | 'checked' | 'conditional' | 'prohibited' | 'unknown' | 'empty' | 'error' | 'product-found'
// 고정 시나리오 목업. 제품 정보 변경으로 실제 판정이 수행되지는 않음.
export function createMockClient({ scenario = 'needs-info', delayMs = 200 }: { scenario?: MockScenario; delayMs?: number } = {}): ApiClient {
  async function reply<T>(value: T, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted()
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal?.reason) }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, delayMs)
      signal?.addEventListener('abort', abort, { once: true })
    })
    if (scenario === 'error') throw new ApiError('INVALID_REQUEST', '요청 형식을 확인해 주세요.', 400)
    return structuredClone(value)
  }
  function airline(id: string) {
    const entry = demoAirlines.find(a => a.id === id)
    if (!entry) throw new ApiError('UNKNOWN_AIRLINE', '항공사 정보를 찾을 수 없습니다.', 404)
    if (!entry.enabled) throw new ApiError('AIRLINE_NOT_ENABLED', '아직 연결되지 않은 항공사입니다.', 409)
  }
  return {
    health: signal => reply({ ok: true, time: new Date().toISOString(), meta: demoMeta }, signal),
    meta: signal => reply(demoMetadata, signal),
    airlines: signal => reply({ airlines: demoAirlines, meta: demoMeta }, signal),
    categories: async (id, signal) => { airline(id); return reply(demoCategories, signal) },
    recognize: async (body, signal) => {
      parseRequest(RecognizeRequestSchema, body); airline(body.airlineId)
      return reply(scenario === 'empty' ? emptyRecognitionExample : recognitionExample, signal)
    },
    resolveProduct: async (body, signal) => {
      parseRequest(ResolveProductRequestSchema, body); airline(body.airlineId)
      if (scenario === 'product-found') {
        const preview = ResolveProductResponseSchema.parse(productCandidate)
        return reply({ ...preview, itemId: body.item.id, candidates: preview.candidates.map(c => ({ ...c, itemId: body.item.id })) }, signal)
      }
      return reply({ itemId: body.item.id, status: 'NEEDS_INFO', candidates: [], missingFields: ['modelName'], message: '시연용 고정 응답입니다. 모델명 확인 후 실제 제품 조회 연동이 필요합니다.', meta: demoMeta }, signal)
    },
    evaluate: async (body, signal) => {
      parseRequest(EvaluateRequestSchema, body); airline(body.airlineId)
      const preview = resultPreviews.find(p => p.id === scenario) ?? resultPreviews[0]!
      return reply({ results: body.items.map(item => ({ ...preview.result, itemId: item.id })), meta: demoMeta }, signal)
    },
  }
}
