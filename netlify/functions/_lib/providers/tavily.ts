import { z } from 'zod'
import { SourceSchema } from '../../../../contract/schemas.ts'
import { LIMITS } from '../../../../contract/v2/constants.ts'
import type { LookupRequest } from '../../../../contract/v2/types.ts'
import { HttpError } from '../errors.ts'

export interface TavilyEnvironment { TAVILY_API_KEY?: string; GEMINI_CALLS_ENABLED?: string }
export interface TavilyResult { title: string; url: string; content: string; score?: number }

export function tavilyReady(environment: TavilyEnvironment) {
  return environment.GEMINI_CALLS_ENABLED === 'true' && /^tvly-[A-Za-z0-9_-]{20,200}$/.test(environment.TAVILY_API_KEY?.trim() ?? '')
}

const TavilyResponseSchema = z.object({
  results: z.array(z.object({
    title: z.string().min(1), url: z.url(), content: z.string(), score: z.number().optional(),
  })).max(5),
})

function timedOut(signal?: AbortSignal) {
  return signal?.aborted && signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError'
}

export async function searchTavily(environment: TavilyEnvironment, input: LookupRequest, request: typeof fetch = fetch, signal?: AbortSignal) {
  if (!tavilyReady(environment)) throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Tavily 서버 설정을 확인해 주세요.')
  const timeout = AbortSignal.timeout(LIMITS.upstreamTimeoutMs)
  try {
    signal?.throwIfAborted()
    const query = [input.brand, input.modelName, 'official product specifications'].filter(Boolean).join(' ')
    const response = await request('https://api.tavily.com/search', {
      method: 'POST', signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${environment.TAVILY_API_KEY}` },
      body: JSON.stringify({ query, topic: 'general', search_depth: 'basic', max_results: 5, include_answer: false, include_raw_content: false, include_images: false }),
    })
    if ([429, 432, 433].includes(response.status)) throw new HttpError(429, 'RATE_LIMITED', '제품 검색 요청 한도에 도달했습니다. 자동 재시도하지 않습니다.')
    if ([401, 403].includes(response.status)) throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Tavily 서버 키·사용 권한을 확인해 주세요.')
    if (!response.ok) throw new Error('upstream failure')
    const output = TavilyResponseSchema.parse(await response.json())
    const unique = new Map<string, z.infer<typeof SourceSchema>>()
    for (const result of output.results) {
      if (!result.url.startsWith('https://') || unique.has(result.url)) continue
      unique.set(result.url, SourceSchema.parse({ title: result.title.slice(0, 200), url: result.url, retrievedAt: new Date().toISOString() }))
    }
    const sources = [...unique.values()].slice(0, 5)
    if (!sources.length) throw new HttpError(502, 'PRODUCT_LOOKUP_FAILED', '제품 검색 출처를 확인하지 못했습니다. 제품 라벨 정보를 직접 입력해 주세요.')
    const results = output.results.filter(result => unique.has(result.url)).slice(0, 5).map(result => ({ ...result, content: result.content.slice(0, 4000) }))
    return { results, sources }
  } catch (error) {
    if (timeout.aborted || timedOut(signal)) throw new HttpError(504, 'UPSTREAM_TIMEOUT', '제품 검색 응답 시간이 초과되었습니다.')
    if (signal?.aborted) throw new HttpError(408, 'REQUEST_TIMEOUT', '요청이 취소되었습니다.')
    if (error instanceof HttpError) throw error
    throw new HttpError(502, 'PRODUCT_LOOKUP_FAILED', '제품 검색 응답·출처를 확인하지 못했습니다.')
  }
}
