import type { z } from 'zod'
import { ApiError, parseRequest } from '../client.ts'
import { ErrorResponseSchema } from '../schemas.ts'
import { API_PREFIX, DEPARTURE_COUNTRY, LIMITS } from './constants.ts'
import * as s from './schemas.ts'
import type { EvaluateRequest, FlightType, LookupRequest, RecognizeRequest } from './types.ts'

export { ApiError }
function validateSemantics(check: () => void, response = false) {
  try { check() } catch { throw new ApiError(response ? 'INVALID_RESPONSE' : 'INVALID_REQUEST', response ? '서버 응답이 계약과 다릅니다.' : '사진·물품 정보의 연결 관계와 출처를 확인해 주세요.') }
}
export function createApiClient({ baseUrl = '', fetch: request = globalThis.fetch }: { baseUrl?: string; fetch?: typeof fetch } = {}) {
  async function call<T>(path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal): Promise<T> {
    const json = body === undefined ? undefined : JSON.stringify(body)
    if (json && new TextEncoder().encode(json).byteLength > (path === 'recognize' ? LIMITS.requestBytes : LIMITS.evaluateBytes)) {
      throw new ApiError('PAYLOAD_TOO_LARGE', '전체 요청 크기가 제한을 초과했습니다. 사진 수·크기 또는 입력 정보를 줄여 주세요.')
    }
    const timeout = AbortSignal.timeout(LIMITS.requestTimeoutMs)
    const response = await request(`${baseUrl.replace(/\/$/, '')}${API_PREFIX}/${path}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'omit',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: json, signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    let data: unknown
    try { data = await response.json() } catch { throw new ApiError('INVALID_RESPONSE', '서버가 JSON 응답을 반환하지 않았습니다.', response.status) }
    if (!response.ok) {
      const failure = ErrorResponseSchema.safeParse(data)
      if (!failure.success) throw new ApiError('INVALID_RESPONSE', '서버 오류 형식이 계약과 다릅니다.', response.status)
      throw new ApiError(failure.data.error.code, failure.data.error.message, response.status)
    }
    const parsed = schema.safeParse(data)
    if (!parsed.success) throw new ApiError('INVALID_RESPONSE', '서버 응답이 계약과 다릅니다.', response.status)
    return parsed.data
  }
  return {
    health: (signal?: AbortSignal) => call('health', s.HealthResponseSchema, undefined, signal),
    meta: (signal?: AbortSignal) => call('meta', s.MetaResponseSchema, undefined, signal),
    airlines: (signal?: AbortSignal) => call('airlines', s.AirlinesResponseSchema, undefined, signal),
    rules: async (airlineId: string, signal?: AbortSignal) => {
      parseRequest(s.RulesQuerySchema, { airlineId })
      const result = await call(`rules?airlineId=${encodeURIComponent(airlineId)}`, s.RulesResponseSchema, undefined, signal)
      validateSemantics(() => { if (result.airlineId !== airlineId) throw new Error('airline id') }, true)
      return result
    },
    categories: async (airlineId: string, flightType: FlightType, signal?: AbortSignal) => {
      parseRequest(s.CategoriesQuerySchema, { airlineId, flightType, departureCountry: DEPARTURE_COUNTRY })
      const result = await call(`categories?airlineId=${encodeURIComponent(airlineId)}&flightType=${flightType}&departureCountry=${DEPARTURE_COUNTRY}`, s.CategoriesResponseSchema, undefined, signal)
      validateSemantics(() => { if (result.airlineId !== airlineId || result.flightType !== flightType || result.departureCountry !== DEPARTURE_COUNTRY) throw new Error('context') }, true)
      return result
    },
    recognize: async (body: RecognizeRequest, signal?: AbortSignal) => {
      const input = parseRequest(s.RecognizeRequestSchema, body)
      validateSemantics(() => s.assertRecognizeRequest(input))
      const result = await call('recognize', s.RecognizeResponseSchema, input, signal)
      validateSemantics(() => s.assertRecognizeResponse(input, result), true)
      return result
    },
    lookup: async (body: LookupRequest, signal?: AbortSignal) => {
      const input = parseRequest(s.LookupRequestSchema, body)
      const result = await call('lookup', s.LookupResponseSchema, input, signal)
      validateSemantics(() => { if (result.itemId !== input.itemId || result.candidates.some(c => c.itemId !== input.itemId)) throw new Error('item id') }, true)
      return result
    },
    evaluate: async (body: EvaluateRequest, signal?: AbortSignal) => {
      const input = parseRequest(s.EvaluateRequestSchema, body)
      validateSemantics(() => s.assertEvaluationItems(input.items))
      const result = await call('evaluate', s.EvaluateResponseSchema, input, signal)
      validateSemantics(() => {
        const ids = new Set(result.results.map(r => r.itemId))
        if (result.airlineId !== input.airlineId || result.flightType !== input.flightType || result.departureCountry !== input.departureCountry || ids.size !== input.items.length || result.results.length !== input.items.length || input.items.some(i => !ids.has(i.id))) throw new Error('result context')
      }, true)
      return result
    },
  }
}
export type ApiClient = ReturnType<typeof createApiClient>
