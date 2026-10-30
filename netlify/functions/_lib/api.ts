import * as s from '../../../contract/schemas.ts'
import { LIMITS } from '../../../contract/constants.ts'
import { demoAirlines, demoCategories, demoMeta, demoMetadata } from '../../../contract/data.ts'
import { corsHeaders, preflight } from './cors.ts'
import { HttpError, invalidRequest, unavailable } from './errors.ts'
import { checkImage, checkItems, parse, readJson } from './input.ts'
import { evaluateStub, recognizeDemo, resolveProductDemo } from './providers/demo.ts'

export interface ApiEnvironment { ALLOWED_ORIGINS?: string; USE_DEMO_RECOGNITION?: string }
const methods: Record<string, string> = {
  '/api/health': 'GET', '/api/meta': 'GET', '/api/airlines': 'GET', '/api/categories': 'GET',
  '/api/recognize': 'POST', '/api/resolve-product': 'POST', '/api/evaluate': 'POST',
}
function checkAirline(id: string) {
  const airline = demoAirlines.find(a => a.id === id)
  if (!airline) throw new HttpError(404, 'UNKNOWN_AIRLINE', '항공사 정보를 찾을 수 없습니다.')
  if (!airline.enabled) throw new HttpError(409, 'AIRLINE_NOT_ENABLED', '아직 연결되지 않은 항공사입니다.')
}

export async function handleApi(request: Request, environment: ApiEnvironment = process.env): Promise<Response> {
  let headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' })
  try {
    headers = corsHeaders(request, environment.ALLOWED_ORIGINS)
    const url = new URL(request.url)
    const method = methods[url.pathname]
    if (!method) throw new HttpError(404, 'NOT_FOUND', 'API 경로를 찾을 수 없습니다.')
    if (request.method === 'OPTIONS') return preflight(request, headers, method)
    if (request.method !== method) {
      headers.set('Allow', `${method}, OPTIONS`)
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', '지원하지 않는 요청 방식입니다.')
    }
    const demoEnabled = environment.USE_DEMO_RECOGNITION === undefined || environment.USE_DEMO_RECOGNITION === 'true'
    let body: unknown
    switch (url.pathname) {
      case '/api/health': body = s.HealthResponseSchema.parse({ ok: true, time: new Date().toISOString(), meta: demoMeta }); break
      case '/api/meta': body = s.MetaResponseSchema.parse({ ...demoMetadata, capabilities: { ...demoMetadata.capabilities, recognition: demoEnabled ? 'demo' : 'unavailable', productLookup: demoEnabled ? 'demo' : 'unavailable' } }); break
      case '/api/airlines': body = s.AirlinesResponseSchema.parse({ airlines: demoAirlines, meta: demoMeta }); break
      case '/api/categories': {
        if ([...url.searchParams.keys()].some(k => k !== 'airlineId') || url.searchParams.getAll('airlineId').length !== 1) throw invalidRequest()
        const query = parse(s.AirlineQuerySchema, Object.fromEntries(url.searchParams))
        checkAirline(query.airlineId)
        body = s.CategoriesResponseSchema.parse(demoCategories)
        break
      }
      case '/api/recognize': {
        const input = parse(s.RecognizeRequestSchema, await readJson(request, LIMITS.requestBytes))
        checkAirline(input.airlineId); checkImage(input.image)
        if (!demoEnabled) throw unavailable()
        body = s.RecognizeResponseSchema.parse(recognizeDemo())
        break
      }
      case '/api/resolve-product': {
        const input = parse(s.ResolveProductRequestSchema, await readJson(request, LIMITS.evaluateBytes))
        checkAirline(input.airlineId); checkItems([input.item])
        if (!demoEnabled) throw unavailable()
        body = s.ResolveProductResponseSchema.parse(resolveProductDemo(input))
        break
      }
      case '/api/evaluate': {
        const input = parse(s.EvaluateRequestSchema, await readJson(request, LIMITS.evaluateBytes))
        checkAirline(input.airlineId); checkItems(input.items)
        body = s.EvaluateResponseSchema.parse(evaluateStub(input))
        break
      }
    }
    return Response.json(body, { headers })
  } catch (error) {
    const failure = error instanceof HttpError ? error : new HttpError(500, 'INTERNAL_ERROR', '요청을 처리하지 못했습니다.')
    return Response.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers })
  }
}
