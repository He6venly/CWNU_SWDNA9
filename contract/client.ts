import type { z } from 'zod'
import * as s from './schemas.ts'
import { LIMITS } from './constants.ts'
import type { EvaluateRequest, RecognizeRequest, ResolveProductRequest } from './types.ts'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}
export function parseRequest<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new ApiError('INVALID_REQUEST', '입력한 물품 정보와 사진 형식을 확인해 주세요.')
  return parsed.data
}
export function createApiClient({ baseUrl = '', fetch: request = globalThis.fetch }: { baseUrl?: string; fetch?: typeof fetch } = {}) {
  async function call<T>(path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal): Promise<T> {
    const timeout = AbortSignal.timeout(LIMITS.requestTimeoutMs)
    const response = await request(`${baseUrl.replace(/\/$/, '')}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      credentials: 'omit',
    })
    let data: unknown
    try { data = await response.json() } catch { throw new ApiError('INVALID_RESPONSE', '서버 응답이 JSON 형식이 아닙니다.', response.status) }
    if (!response.ok) {
      const parsed = s.ErrorResponseSchema.safeParse(data)
      if (!parsed.success) throw new ApiError('INVALID_RESPONSE', '서버 오류 응답 형식을 확인해 주세요.', response.status)
      throw new ApiError(parsed.data.error.code, parsed.data.error.message, response.status)
    }
    const parsed = schema.safeParse(data)
    if (!parsed.success) throw new ApiError('INVALID_RESPONSE', '서버 응답이 계약과 다릅니다.', response.status)
    return parsed.data
  }
  return {
    health: (signal?: AbortSignal) => call('health', s.HealthResponseSchema, undefined, signal),
    meta: (signal?: AbortSignal) => call('meta', s.MetaResponseSchema, undefined, signal),
    airlines: (signal?: AbortSignal) => call('airlines', s.AirlinesResponseSchema, undefined, signal),
    categories: (airlineId: string, signal?: AbortSignal) => call(`categories?airlineId=${encodeURIComponent(airlineId)}`, s.CategoriesResponseSchema, undefined, signal),
    recognize: async (body: RecognizeRequest, signal?: AbortSignal) => call('recognize', s.RecognizeResponseSchema, parseRequest(s.RecognizeRequestSchema, body), signal),
    resolveProduct: async (body: ResolveProductRequest, signal?: AbortSignal) => call('resolve-product', s.ResolveProductResponseSchema, parseRequest(s.ResolveProductRequestSchema, body), signal),
    evaluate: async (body: EvaluateRequest, signal?: AbortSignal) => call('evaluate', s.EvaluateResponseSchema, parseRequest(s.EvaluateRequestSchema, body), signal),
  }
}
export type ApiClient = ReturnType<typeof createApiClient>
