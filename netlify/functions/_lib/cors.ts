import { HttpError } from './errors.ts'

export function corsHeaders(request: Request, allowedOrigins = '') {
  const headers = new Headers({
    'Vary': 'Origin', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Type': 'application/json; charset=utf-8',
  })
  const origin = request.headers.get('Origin')
  if (!origin) return headers
  const allowed = new Set(allowedOrigins.split(',').map(v => v.trim()).filter(Boolean))
  allowed.add(new URL(request.url).origin)
  if (origin === 'null' || !allowed.has(origin)) throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 요청 출처입니다.')
  headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

export function preflight(request: Request, headers: Headers, method: string) {
  if (request.headers.get('Access-Control-Request-Method') !== method) throw new HttpError(405, 'METHOD_NOT_ALLOWED', '지원하지 않는 요청 방식입니다.')
  const requested = (request.headers.get('Access-Control-Request-Headers') ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
  if (requested.some(h => h !== 'content-type')) throw new HttpError(400, 'INVALID_REQUEST', '허용되지 않은 요청 헤더입니다.')
  headers.set('Access-Control-Allow-Methods', `${method}, OPTIONS`)
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return new Response(null, { status: 204, headers })
}
