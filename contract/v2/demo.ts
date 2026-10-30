import fixtureItems from './fixtures/items.json' with { type: 'json' }
import { demoAirlines as legacyAirlines } from '../data.ts'
import { CONTRACT_VERSION, FIELD_KEYS, LIMITS } from './constants.ts'
import { labels } from './labels.ts'
import * as s from './schemas.ts'
import type { EvaluateRequest, EvaluateResponse, LookupRequest, LookupResponse, RecognizeRequest, RecognizeResponse } from './types.ts'

export type RecognitionScenario = 'standard' | 'empty' | 'multiple' | 'no-label' | 'blur' | 'risk-estimate' | 'low-confidence'
export const demoMeta = { contractVersion: CONTRACT_VERSION, isDemoRecognition: true, isDemoRules: true, isDemoLookup: true } as const
export const demoAirlines = s.AirlinesResponseSchema.parse({
  airlines: [legacyAirlines[0], { id: 'korean-air', name: '대한항공 (실제 규정 연동 준비 중)', enabled: false, isDemo: false }].map(a => ({ ...a, supportedFlightTypes: ['domestic', 'international'] })),
  meta: demoMeta,
}).airlines
export const demoCategories = s.CategoriesResponseSchema.shape.categories.parse([
  { id: 'power-bank', label: '보조배터리', requiredFields: { cabin: ['wh'], checked: [] }, estimatePolicy: 'never_definitive' },
  { id: 'cordless-iron', label: '무선 고데기', requiredFields: { cabin: ['modelName'], checked: ['modelName'] }, estimatePolicy: 'never_definitive' },
  { id: 'liquid', label: '액체·젤류', requiredFields: { cabin: ['ml'], checked: [] }, estimatePolicy: 'never_definitive' },
  { id: 'lighter', label: '라이터', requiredFields: { cabin: ['count'], checked: [] }, estimatePolicy: 'never_definitive' },
  { id: 'electronics', label: '일반 전자기기', requiredFields: { cabin: [], checked: [] }, estimatePolicy: 'never_definitive' },
  { id: 'general-items', label: '일반 소지품', requiredFields: { cabin: [], checked: [] }, estimatePolicy: 'allowed_with_confirm' },
])
export const demoMetadata = s.MetaResponseSchema.parse({
  meta: demoMeta, labels, limits: LIMITS, plannedAirlineId: 'korean-air',
  supportedCaptureModes: ['overview', 'detail'], supportedFlightTypes: ['domestic', 'international'],
  supportedDepartureCountries: ['KR'],
  capabilities: { recognition: 'demo', productLookup: 'demo', evaluation: 'stub' },
})

export function recognizeDemo(input: RecognizeRequest, scenario: RecognitionScenario = 'standard'): RecognizeResponse {
  s.assertRecognizeRequest(input)
  const detail = input.captureMode === 'detail'
  const noLabel = detail && input.mode === 'label' && scenario === 'no-label'
  const multiple = detail && scenario === 'multiple'
  const empty = scenario === 'empty' || scenario === 'blur' || noLabel || multiple
  const image = (detail && input.mode === 'label' ? input.images.find(i => i.kind === 'label') : input.images[0])!
  const sourceItems = input.captureMode === 'overview' ? [fixtureItems.estimate, fixtureItems.riskEstimate]
    : input.mode === 'label' ? [fixtureItems.label] : [scenario === 'risk-estimate' ? fixtureItems.riskEstimate : fixtureItems.estimate]
  const items = empty ? [] : sourceItems.map(source => {
    const item = s.DetectedItemSchema.parse(structuredClone(source))
    item.imageId = image.id
    if (detail && input.targetItemId) item.id = input.targetItemId
    for (const field of FIELD_KEYS) if (item.fieldSources[field]?.source === 'label') item.fieldSources[field]!.imageId = image.id
    if (scenario === 'low-confidence' && item.identification === 'ai_estimated') {
      item.confidence = 0.4
      if (item.estimate) item.estimate.candidates[0]!.confidence = 0.4
    }
    return item
  })
  const output = s.RecognizeResponseSchema.parse({
    captureMode: input.captureMode, items,
    imageQuality: input.images.map(i => ({ imageId: i.id, source: 'demo', usable: null, issues: scenario === 'blur' ? ['blur'] : noLabel ? ['no_label_found'] : [] })),
    suggestRetake: empty, suggestEstimateMode: noLabel, multipleItemsDetected: multiple || (!detail && items.length > 1),
    needsLabelPhoto: !items.length || items.some(i => i.categoryId !== 'general-items' && i.unreadFields.length > 0),
    warnings: [{ code: 'DEMO_RESPONSE', message: '사진 내용과 무관한 고정 시나리오입니다. 실제 AI 인식·이미지 품질 검사 결과가 아닙니다.' },
      ...(multiple ? [{ code: 'MULTIPLE_ITEMS', message: '개별 사진에는 같은 물품만 담아 주세요. (시연 시나리오)' }]
        : noLabel ? [{ code: 'NO_LABEL_FOUND', message: '라벨 사진을 다시 등록하거나 종류 추정을 선택해 주세요. (시연 시나리오)' }]
        : scenario === 'blur' ? [{ code: 'POOR_IMAGE', message: '더 선명한 사진을 선택해 주세요. (시연 시나리오)' }]
        : !items.length ? [{ code: 'NO_ITEM_DETECTED', message: '물품을 확인할 수 없습니다. 다른 사진을 등록해 주세요. (시연 시나리오)' }] : [])],
    meta: demoMeta,
  })
  s.assertRecognizeResponse(input, output)
  return output
}
export function lookupStub(input: LookupRequest): LookupResponse {
  return { itemId: input.itemId, candidates: [], message: '실제 제품 조회 미연결. 후보가 없으면 제품 라벨을 직접 확인해 주세요.', meta: demoMeta }
}
export function evaluateStub(input: EvaluateRequest): EvaluateResponse {
  return {
    airlineId: input.airlineId, flightType: input.flightType, departureCountry: input.departureCountry, ruleVersion: null,
    results: input.items.map(item => ({
      itemId: item.id, cabin: { verdict: 'NEEDS_INFO', reason: `${item.confirmed ? '' : '사용자 확인 전. '}규정 엔진 미연결. 현재는 시연용 고정 응답입니다.` },
      checked: { verdict: 'NEEDS_INFO', reason: `${item.confirmed ? '' : '사용자 확인 전. '}규정 엔진 미연결. 현재는 시연용 고정 응답입니다.` },
      action: 'CHECK_CONDITIONS', missingFields: [], derivedFields: {},
      staffSummary: `기내·위탁: 제품 정보 확인 필요 / ${labels.flightTypes[input.flightType]} / 시연용 고정 응답`, isDemo: true,
    })), meta: demoMeta,
  }
}
