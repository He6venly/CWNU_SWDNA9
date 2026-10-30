import * as s from '../../../contract/v2/schemas.ts'
import { LIMITS, API_PREFIX } from '../../../contract/v2/constants.ts'
import { demoAirlines, demoCategories, demoMeta, demoMetadata, evaluateStub, lookupStub, recognizeDemo } from '../../../contract/v2/demo.ts'
import { corsHeaders, preflight } from './cors.ts'
import { checkImage, parse, readJson } from './input.ts'
import { HttpError, invalidRequest, unavailable } from './errors.ts'
import { evaluateAirline } from './rules/evaluate.ts'
import { airlineRulesCurrent } from './rules/airline-profiles.ts'
import { airlineRuleMetadata, supportedAirlineList } from './rules/airlines.ts'
import { createGeminiV2, geminiReady } from './providers/gemini-v2.ts'
import type { GeminiEnvironment } from './providers/gemini-v2.ts'
import { tavilyReady, type TavilyEnvironment } from './providers/tavily.ts'

function airlines() {
  return [...demoAirlines.filter((airline) => airline.isDemo), ...supportedAirlineList()]
}

function semantics(check: () => void) { try { check() } catch { throw invalidRequest() } }
function checkAirline(id: string, flightType?: 'domestic' | 'international') {
  const entry = airlines().find(a => a.id === id)
  if (!entry) throw new HttpError(404, 'UNKNOWN_AIRLINE', '항공사 정보를 찾을 수 없습니다.')
  if (!entry.enabled) throw new HttpError(409, 'AIRLINE_NOT_ENABLED', '해당 항공사의 공식 규정 재검수가 필요합니다.')
  if (flightType && !entry.supportedFlightTypes.some((type) => type === flightType)) throw new HttpError(409, 'AIRLINE_NOT_ENABLED', '선택한 항공사는 해당 노선을 지원하지 않습니다.')
}
export async function handleApiV2(request: Request, environment: GeminiEnvironment & TavilyEnvironment & { ALLOWED_ORIGINS?: string; USE_DEMO_RECOGNITION?: string }) {
  let headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' })
  try {
    headers = corsHeaders(request, environment.ALLOWED_ORIGINS)
    const url = new URL(request.url), operation = url.pathname.slice(API_PREFIX.length + 1)
    if (!Object.hasOwn(s.operationSchemas, operation)) throw new HttpError(404, 'NOT_FOUND', 'API 경로를 찾을 수 없습니다.')
    const method = ['recognize', 'lookup', 'evaluate'].includes(operation) ? 'POST' : 'GET'
    if (request.method === 'OPTIONS') return preflight(request, headers, method)
    if (request.method !== method) { headers.set('Allow', `${method}, OPTIONS`); throw new HttpError(405, 'METHOD_NOT_ALLOWED', '지원하지 않는 요청 방식입니다.') }
    if (!['categories', 'rules'].includes(operation) && url.search) throw invalidRequest()
    const demoEnabled = environment.USE_DEMO_RECOGNITION === 'true'
    const demoRuntimeMeta = { ...demoMeta, isDemoRecognition: demoEnabled, isDemoLookup: demoEnabled }
    const rulesMeta = { ...demoRuntimeMeta, isDemoRules: false }
    let body: unknown
    switch (operation) {
      case 'health': body = s.HealthResponseSchema.parse({ ok: true, time: new Date().toISOString(), meta: rulesMeta }); break
      case 'meta': body = s.MetaResponseSchema.parse({ ...demoMetadata, meta: rulesMeta, capabilities: { recognition: demoEnabled ? 'demo' : geminiReady(environment) ? 'gemini' : 'unavailable', productLookup: demoEnabled ? 'demo' : tavilyReady(environment) ? 'tavily' : 'unavailable', evaluation: airlineRulesCurrent() ? 'rules' : 'unavailable' } }); break
      case 'airlines': body = s.AirlinesResponseSchema.parse({ airlines: airlines(), meta: rulesMeta }); break
      case 'rules': {
        if (url.searchParams.getAll('airlineId').length !== 1) throw invalidRequest()
        const query = parse(s.RulesQuerySchema, Object.fromEntries(url.searchParams))
        const metadata = airlineRuleMetadata(query.airlineId)
        if (!metadata) throw new HttpError(404, 'NOT_FOUND', '지원하지 않는 항공사입니다.')
        body = { ...metadata, meta: rulesMeta }
        break
      }
      case 'categories': {
        if (['airlineId', 'flightType', 'departureCountry'].some(key => url.searchParams.getAll(key).length !== 1)) throw invalidRequest()
        const query = parse(s.CategoriesQuerySchema, Object.fromEntries(url.searchParams))
        checkAirline(query.airlineId, query.flightType)
        const required = { 'power-bank': ['wh', 'count'], 'cordless-iron': ['wh'], liquid: ['ml', 'count'], lighter: ['count'], electronics: ['wh', 'count'], 'general-items': [] }
        const categories = demoCategories.map(category => ({ ...category,
          requiredFields: { cabin: required[category.id], checked: ['liquid', 'electronics'].includes(category.id) ? required[category.id] : [] }, estimatePolicy: 'never_definitive',
        }))
        body = s.CategoriesResponseSchema.parse({ ...query, categories, meta: rulesMeta })
        break
      }
      case 'recognize': {
        const input = parse(s.RecognizeRequestSchema, await readJson(request, LIMITS.requestBytes))
        semantics(() => s.assertRecognizeRequest(input))
        input.images.forEach(checkImage)
        if (!demoEnabled && !geminiReady(environment)) throw unavailable()
        body = s.RecognizeResponseSchema.parse(demoEnabled ? recognizeDemo(input) : await createGeminiV2(environment).recognize(input, request.signal))
        break
      }
      case 'lookup': {
        const input = parse(s.LookupRequestSchema, await readJson(request, LIMITS.evaluateBytes))
        if (!demoEnabled && !tavilyReady(environment)) throw unavailable()
        body = s.LookupResponseSchema.parse(demoEnabled ? lookupStub(input) : await createGeminiV2(environment).lookup(input, request.signal))
        break
      }
      case 'evaluate': {
        const input = parse(s.EvaluateRequestSchema, await readJson(request, LIMITS.evaluateBytes))
        semantics(() => s.assertEvaluationItems(input.items))
        checkAirline(input.airlineId, input.flightType)
        const selected = airlines().find((airline) => airline.id === input.airlineId)!
        const result = selected.isDemo ? evaluateStub(input) : evaluateAirline(input)
        body = s.EvaluateResponseSchema.parse({ ...result, meta: { ...result.meta, isDemoRecognition: demoEnabled, isDemoLookup: demoEnabled } })
        break
      }
    }
    return Response.json(body, { headers })
  } catch (error) {
    const failure = error instanceof HttpError ? error : new HttpError(500, 'INTERNAL_ERROR', '요청을 처리하지 못했습니다.')
    return Response.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers })
  }
}
