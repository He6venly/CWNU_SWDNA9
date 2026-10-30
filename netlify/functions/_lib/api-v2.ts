import * as s from '../../../contract/v2/schemas.ts'
import { LIMITS, API_PREFIX } from '../../../contract/v2/constants.ts'
import { demoAirlines, demoCategories, demoMeta, demoMetadata, evaluateStub, lookupStub, recognizeDemo } from '../../../contract/v2/demo.ts'
import { corsHeaders, preflight } from './cors.ts'
import { checkImage, parse, readJson } from './input.ts'
import { HttpError, invalidRequest, unavailable } from './errors.ts'

function semantics(check: () => void) { try { check() } catch { throw invalidRequest() } }
function checkAirline(id: string) {
  const entry = demoAirlines.find(a => a.id === id)
  if (!entry) throw new HttpError(404, 'UNKNOWN_AIRLINE', '항공사 정보를 찾을 수 없습니다.')
  if (!entry.enabled) throw new HttpError(409, 'AIRLINE_NOT_ENABLED', '해당 항공사는 실제 규정 연결 준비 중입니다.')
}
export async function handleApiV2(request: Request, environment: { ALLOWED_ORIGINS?: string; USE_DEMO_RECOGNITION?: string }) {
  let headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' })
  try {
    headers = corsHeaders(request, environment.ALLOWED_ORIGINS)
    const url = new URL(request.url), operation = url.pathname.slice(API_PREFIX.length + 1)
    if (!Object.hasOwn(s.operationSchemas, operation)) throw new HttpError(404, 'NOT_FOUND', 'API 경로를 찾을 수 없습니다.')
    const method = ['recognize', 'lookup', 'evaluate'].includes(operation) ? 'POST' : 'GET'
    if (request.method === 'OPTIONS') return preflight(request, headers, method)
    if (request.method !== method) { headers.set('Allow', `${method}, OPTIONS`); throw new HttpError(405, 'METHOD_NOT_ALLOWED', '지원하지 않는 요청 방식입니다.') }
    if (operation !== 'categories' && url.search) throw invalidRequest()
    const demoEnabled = environment.USE_DEMO_RECOGNITION === undefined || environment.USE_DEMO_RECOGNITION === 'true'
    let body: unknown
    switch (operation) {
      case 'health': body = s.HealthResponseSchema.parse({ ok: true, time: new Date().toISOString(), meta: demoMeta }); break
      case 'meta': body = s.MetaResponseSchema.parse({ ...demoMetadata, capabilities: { ...demoMetadata.capabilities, recognition: demoEnabled ? 'demo' : 'unavailable', productLookup: demoEnabled ? 'demo' : 'unavailable' } }); break
      case 'airlines': body = s.AirlinesResponseSchema.parse({ airlines: demoAirlines, meta: demoMeta }); break
      case 'categories': {
        if (['airlineId', 'flightType', 'departureCountry'].some(key => url.searchParams.getAll(key).length !== 1)) throw invalidRequest()
        const query = parse(s.CategoriesQuerySchema, Object.fromEntries(url.searchParams))
        checkAirline(query.airlineId)
        body = s.CategoriesResponseSchema.parse({ ...query, categories: demoCategories, meta: demoMeta })
        break
      }
      case 'recognize': {
        const input = parse(s.RecognizeRequestSchema, await readJson(request, LIMITS.requestBytes))
        semantics(() => s.assertRecognizeRequest(input))
        input.images.forEach(checkImage)
        if (!demoEnabled) throw unavailable()
        body = s.RecognizeResponseSchema.parse(recognizeDemo(input))
        break
      }
      case 'lookup': {
        const input = parse(s.LookupRequestSchema, await readJson(request, LIMITS.evaluateBytes))
        if (!demoEnabled) throw unavailable()
        body = s.LookupResponseSchema.parse(lookupStub(input))
        break
      }
      case 'evaluate': {
        const input = parse(s.EvaluateRequestSchema, await readJson(request, LIMITS.evaluateBytes))
        semantics(() => s.assertItems(input.items))
        checkAirline(input.airlineId)
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
