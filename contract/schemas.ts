import { z } from 'zod'
import { CATEGORY_IDS, CONTRACT_VERSION, FIELD_KEYS, LIMITS } from './constants.ts'

// eslint-disable-next-line no-control-regex -- API 표시 문자열의 제어문자 입력을 차단.
const text = (max: number) => z.string().min(1).max(max).regex(/^[^\u0000-\u001f\u007f]*\S[^\u0000-\u001f\u007f]*$/u)
export const IdSchema = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/)
export const FieldKeySchema = z.enum(FIELD_KEYS)
export const VerdictSchema = z.enum(['ALLOWED', 'CONDITIONAL', 'PROHIBITED', 'NEEDS_INFO'])
export const ActionSchema = z.enum(['PUT_IN_CABIN', 'PUT_IN_CHECKED', 'CHECK_CONDITIONS', 'LEAVE_BEHIND'])
export const FieldsSchema = z.strictObject({
  modelName: text(120).nullable(), wh: z.number().positive().max(1_000_000).nullable(),
  mah: z.number().positive().max(100_000_000).nullable(), volts: z.number().positive().max(1000).nullable(),
  ml: z.number().positive().max(1_000_000).nullable(), count: z.int().min(1).max(100).nullable(),
})
export const DetectedItemSchema = z.strictObject({
  id: IdSchema, name: text(120), categoryId: z.enum(CATEGORY_IDS).nullable(),
  confidence: z.number().min(0).max(1),
  bbox: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().positive().max(1), z.number().positive().max(1)]).optional()
    .describe('원본 이미지 기준 정규화 [x,y,width,height]. 미확인이면 생략. x+width,y+height는 1 이하.'),
  fields: FieldsSchema, unreadFields: z.array(FieldKeySchema).max(FIELD_KEYS.length),
})
export const ItemInfoSchema = DetectedItemSchema.extend({ confirmed: z.boolean(), userEdited: z.boolean() })
export const MetaSchema = z.strictObject({
  isDemoRecognition: z.boolean(), isDemoRules: z.boolean(), contractVersion: z.literal(CONTRACT_VERSION),
})
export const ResultDetailSchema = z.strictObject({ verdict: VerdictSchema, reason: text(600) })
export const ItemResultSchema = z.strictObject({
  itemId: IdSchema, cabin: ResultDetailSchema, checked: ResultDetailSchema, action: ActionSchema,
  missingFields: z.array(FieldKeySchema).max(FIELD_KEYS.length), staffSummary: text(1200), isDemo: z.boolean(),
})
export const SourceSchema = z.strictObject({
  title: text(200), url: z.url().max(2048).regex(/^https:\/\//), retrievedAt: z.iso.datetime(),
})
export const ProductCandidateSchema = z.strictObject({
  id: IdSchema, itemId: IdSchema, name: text(120), fields: FieldsSchema,
  sources: z.array(SourceSchema).min(1).max(5), requiresConfirmation: z.literal(true),
})
export const ImageSchema = z.strictObject({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  base64: z.string().min(4).max(Math.ceil(LIMITS.imageBytes / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/)
    .describe('data URL 접두사 없는 표준 base64. 디코딩 이미지 상한 2MiB.'),
})
export const AirlineQuerySchema = z.strictObject({ airlineId: IdSchema })
export const RecognizeRequestSchema = z.strictObject({ airlineId: IdSchema, image: ImageSchema })
export const ResolveProductRequestSchema = z.strictObject({ airlineId: IdSchema, item: ItemInfoSchema })
export const EvaluateRequestSchema = z.strictObject({ airlineId: IdSchema, items: z.array(ItemInfoSchema).min(1).max(LIMITS.maxItems) })
export const HealthResponseSchema = z.strictObject({ ok: z.literal(true), time: z.iso.datetime(), meta: MetaSchema })
const LabelMapSchema = z.strictObject({
  title: z.string(), verdicts: z.record(VerdictSchema, z.string()), actions: z.record(ActionSchema, z.string()),
  fields: z.record(FieldKeySchema, z.string()), demoBanner: z.string(), stubBanner: z.string(), referenceNotice: z.string(), productNotice: z.string(),
})
export const MetaResponseSchema = z.strictObject({
  meta: MetaSchema, labels: LabelMapSchema,
  capabilities: z.strictObject({
    recognition: z.enum(['demo', 'gemini', 'unavailable']),
    productLookup: z.enum(['demo', 'gemini', 'unavailable']),
    evaluation: z.enum(['stub', 'gemini', 'rules', 'unavailable']),
  }),
  limits: z.strictObject({
    requestBytes: z.int(), evaluateBytes: z.int(), imageBytes: z.int(), clientImageBytes: z.int(),
    imageLongEdge: z.int(), maxItems: z.int(), requestTimeoutMs: z.int(), upstreamTimeoutMs: z.int(),
  }),
})
export const AirlineSchema = z.strictObject({ id: IdSchema, name: text(80), enabled: z.boolean(), isDemo: z.boolean() })
export const AirlinesResponseSchema = z.strictObject({ airlines: z.array(AirlineSchema), meta: MetaSchema })
export const CategorySchema = z.strictObject({
  id: z.enum(CATEGORY_IDS), label: text(80),
  requiredFields: z.strictObject({ cabin: z.array(FieldKeySchema), checked: z.array(FieldKeySchema) }),
})
export const CategoriesResponseSchema = z.strictObject({ airlineId: IdSchema, categories: z.array(CategorySchema), meta: MetaSchema })
export const RecognizeResponseSchema = z.strictObject({ items: z.array(DetectedItemSchema).max(LIMITS.maxItems), meta: MetaSchema })
export const ResolveProductResponseSchema = z.strictObject({
  itemId: IdSchema, status: z.enum(['NEEDS_INFO', 'CANDIDATES_FOUND', 'NOT_FOUND']),
  candidates: z.array(ProductCandidateSchema).max(5), missingFields: z.array(FieldKeySchema), message: text(600), meta: MetaSchema,
})
export const EvaluateResponseSchema = z.strictObject({ results: z.array(ItemResultSchema).min(1).max(LIMITS.maxItems), meta: MetaSchema })
// 프론트 IndexedDB 저장 형식. 서버 저장 엔드포인트가 아님.
export const CatalogCardSchema = z.strictObject({
  id: IdSchema, photoKey: IdSchema, item: ItemInfoSchema, result: ItemResultSchema,
  airline: AirlineSchema, productSources: z.array(SourceSchema).max(5),
  savedAt: z.iso.datetime(), evaluatedAt: z.iso.datetime(), meta: MetaSchema,
})
export const ErrorCodeSchema = z.enum([
  'INVALID_REQUEST', 'UNKNOWN_AIRLINE', 'AIRLINE_NOT_ENABLED', 'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE', 'ORIGIN_NOT_ALLOWED', 'METHOD_NOT_ALLOWED', 'NOT_FOUND',
  'REQUEST_TIMEOUT', 'RECOGNITION_FAILED', 'PRODUCT_LOOKUP_FAILED', 'EVALUATION_FAILED',
  'UPSTREAM_TIMEOUT', 'SERVICE_UNAVAILABLE', 'RATE_LIMITED', 'INTERNAL_ERROR',
])
export const ErrorResponseSchema = z.strictObject({ error: z.strictObject({ code: ErrorCodeSchema, message: text(300) }) })

// JSON Schema 외 의미 검증. 숫자·문자열 변환이나 자동 보정 없이 거부.
export function assertItemSemantics(item: z.infer<typeof DetectedItemSchema>) {
  if (new Set(item.unreadFields).size !== item.unreadFields.length) throw new Error('duplicate unreadFields')
  if (FIELD_KEYS.some(key => (item.fields[key] === null) !== item.unreadFields.includes(key))) throw new Error('unreadFields mismatch')
  if (item.bbox && (item.bbox[0] + item.bbox[2] > 1 || item.bbox[1] + item.bbox[3] > 1)) throw new Error('bbox bounds')
}

export const operationSchemas = {
  health: { response: HealthResponseSchema }, meta: { response: MetaResponseSchema },
  airlines: { response: AirlinesResponseSchema }, categories: { request: AirlineQuerySchema, response: CategoriesResponseSchema },
  recognize: { request: RecognizeRequestSchema, response: RecognizeResponseSchema },
  resolveProduct: { request: ResolveProductRequestSchema, response: ResolveProductResponseSchema },
  evaluate: { request: EvaluateRequestSchema, response: EvaluateResponseSchema },
} as const
