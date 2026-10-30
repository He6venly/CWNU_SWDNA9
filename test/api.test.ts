import { describe, expect, it, vi } from 'vitest'
import { handleApi } from '../netlify/functions/_lib/api.ts'
import { readJson } from '../netlify/functions/_lib/input.ts'
import * as s from '../contract/schemas.ts'
import { DEMO_AIRLINE_ID, LIMITS } from '../contract/constants.ts'
import { evaluateExample, recognitionExample } from '../contract/examples.ts'
import { createApiClient } from '../contract/client.ts'

const origin = 'https://frontend.example'
const image = { mimeType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==' }
const makeRequest = (path: string, body?: unknown, headers: Record<string, string> = {}) => new Request(`https://api.example/api/${path}`, {
  method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
})
describe('HTTP 핸들러 교차검증', () => {
  it('실제 클라이언트로 health·meta·목록·인식·제품조회·판정 호출', async () => {
    const client = createApiClient({ baseUrl: 'https://api.example', fetch: async (url, init) => handleApi(new Request(url, init), { USE_DEMO_RECOGNITION: 'true' }) })
    expect((await client.health()).meta.contractVersion).toBe('1.0.0')
    expect((await client.meta()).capabilities).toEqual({ recognition: 'demo', productLookup: 'demo', evaluation: 'stub' })
    expect((await client.airlines()).airlines.filter(a => a.enabled)).toHaveLength(1)
    expect((await client.categories(DEMO_AIRLINE_ID)).categories).toHaveLength(5)
    expect(await client.recognize({ airlineId: DEMO_AIRLINE_ID, image: { ...image, mimeType: 'image/png' } })).toEqual(recognitionExample)
    expect((await client.resolveProduct({ airlineId: DEMO_AIRLINE_ID, item: evaluateExample.items[0]! })).status).toBe('NEEDS_INFO')
    const result = await client.evaluate(evaluateExample)
    expect(result.results).toHaveLength(4)
    expect(result.results.every(r => r.cabin.verdict === 'NEEDS_INFO' && r.checked.verdict === 'NEEDS_INFO')).toBe(true)
    expect(result.results.every(r => r.cabin.reason.includes('사용자 확인 전'))).toBe(true)
  })
  it('허용 Origin과 사전 요청, 자격증명 미사용', async () => {
    const headers = { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
    const response = await handleApi(new Request('https://api.example/api/evaluate', { method: 'OPTIONS', headers }), { ALLOWED_ORIGINS: origin })
    expect(response.status).toBe(204); expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
    expect(response.headers.has('Access-Control-Allow-Credentials')).toBe(false)
    const result = await handleApi(makeRequest('evaluate', evaluateExample, { Origin: origin }), { ALLOWED_ORIGINS: origin })
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe(origin)
  })
  it.each(['https://frontend.example.evil', 'null', 'https://evil.example'])('다른 Origin 거부: %s', async bad => {
    const response = await handleApi(makeRequest('health', undefined, { Origin: bad }), { ALLOWED_ORIGINS: origin })
    expect(response.status).toBe(403); expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false)
    expect(s.ErrorResponseSchema.safeParse(await response.json()).success).toBe(true)
  })
  it('동일 출처·Origin 없는 CLI 요청 허용', async () => {
    expect((await handleApi(makeRequest('health', undefined, { Origin: 'https://api.example' }), {})).status).toBe(200)
    expect((await handleApi(makeRequest('health'), {})).status).toBe(200)
  })
  it('잘못된 요청에도 허용 Origin 헤더 유지', async () => {
    const response = await handleApi(makeRequest('evaluate', {}, { Origin: origin }), { ALLOWED_ORIGINS: origin })
    expect(response.status).toBe(400); expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
  })
  it('unknown /api는 JSON 404이며 SPA HTML이 아님', async () => {
    const response = await handleApi(makeRequest('unknown'), {})
    expect(response.status).toBe(404); expect((await response.json()).error.code).toBe('NOT_FOUND')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
  it('지원하지 않는 메서드 405', async () => {
    expect((await handleApi(makeRequest('health', {}), {})).status).toBe(405)
  })
  it.each([
    ['evaluate', {}], ['evaluate', { ...evaluateExample, items: [] }],
    ['evaluate', { ...evaluateExample, items: [...evaluateExample.items, evaluateExample.items[0]] }],
    ['categories', undefined], ['categories?airlineId=demo-airline&airlineId=demo-airline', undefined],
    ['recognize', { airlineId: DEMO_AIRLINE_ID, image: { mimeType: 'image/jpeg', base64: image.base64 } }],
    ['recognize', { airlineId: DEMO_AIRLINE_ID, image: { mimeType: 'image/png', base64: '!!!bad' } }],
  ] as const)('잘못된 입력 거부: %s', async (path, body) => {
    const response = await handleApi(makeRequest(path, body), {})
    expect(response.status).toBe(400); expect((await response.json()).error.code).toBe('INVALID_REQUEST')
  })
  it('잘못된 JSON·미디어 타입·알 수 없는 항공사·준비 중 항공사', async () => {
    const invalid = await handleApi(new Request('https://api.example/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), {})
    expect(invalid.status).toBe(400)
    const media = await handleApi(new Request('https://api.example/api/evaluate', { method: 'POST', body: '{}' }), {})
    expect(media.status).toBe(415)
    expect((await handleApi(makeRequest('categories?airlineId=unknown'), {})).status).toBe(404)
    expect((await handleApi(makeRequest('categories?airlineId=pending-airline-1'), {})).status).toBe(409)
  })
  it('본문 Content-Length·실제 스트림 크기를 모두 제한', async () => {
    const early = await handleApi(makeRequest('evaluate', {}, { 'Content-Length': String(LIMITS.evaluateBytes + 1) }), {})
    expect(early.status).toBe(413)
    const actual = await handleApi(makeRequest('evaluate', { padding: 'x'.repeat(LIMITS.evaluateBytes) }), {})
    expect(actual.status).toBe(413)
  })
  it('큰 base64 검증이 예외나 긴 정규식 재귀 없이 413 반환', async () => {
    const response = await handleApi(makeRequest('recognize', { airlineId: DEMO_AIRLINE_ID, image: { mimeType: 'image/png', base64: 'A'.repeat(Math.ceil(LIMITS.imageBytes / 3) * 4 + 4) } }), {})
    expect(response.status).toBe(413)
  })
  it('느린 본문을 시간 제한으로 중단', async () => {
    vi.useFakeTimers()
    try {
      const request = new Request('https://api.example/api/evaluate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: new ReadableStream({ start() {} }), duplex: 'half',
      } as RequestInit & { duplex: 'half' })
      const result = readJson(request, 100).catch(error => error)
      await vi.advanceTimersByTimeAsync(5001)
      expect(await result).toMatchObject({ status: 408, code: 'REQUEST_TIMEOUT' })
    } finally { vi.useRealTimers() }
  })
  it('전체 사진이나 내부 오류를 응답·로그에 내보내지 않음', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const response = await handleApi(makeRequest('recognize', { airlineId: DEMO_AIRLINE_ID, image }), {})
      expect(JSON.stringify(await response.json())).not.toContain(image.base64)
      expect(log).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })
  it('실제 AI 플래그를 켜도 데모로 조용히 대체하거나 외부 호출하지 않음', async () => {
    const response = await handleApi(makeRequest('recognize', { airlineId: DEMO_AIRLINE_ID, image }), { USE_DEMO_RECOGNITION: 'false' })
    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe('SERVICE_UNAVAILABLE')
  })
})
