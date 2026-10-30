import { z } from 'zod'
import * as v1 from '../schemas.ts'
import { CATEGORY_IDS, CONTRACT_VERSION, DEPARTURE_COUNTRY, FIELD_KEYS, FLIGHT_TYPES, LIMITS } from './constants.ts'

const shortText = (max = 120) => v1.ResultDetailSchema.shape.reason.max(max)
export const FieldKeySchema = z.enum(FIELD_KEYS)
export const FlightTypeSchema = z.enum(FLIGHT_TYPES)
export const CaptureModeSchema = z.enum(['overview', 'detail'])
export const FieldsSchema = v1.FieldsSchema.extend({ brand: shortText().nullable() })
export const FieldSourceSchema = z.strictObject({
  source: z.enum(['label', 'user', 'calculated', 'lookup']), confirmed: z.boolean(),
  imageId: v1.IdSchema.optional(), sourceUrl: v1.SourceSchema.shape.url.optional(),
  basis: z.literal('mah*volts/1000').optional(), voltageType: z.enum(['nominal', 'output', 'unknown']).optional(),
})
export const EstimateSchema = z.strictObject({
  basis: shortText(400),
  candidates: z.array(z.strictObject({ name: shortText(), categoryId: z.enum(CATEGORY_IDS).nullable(), confidence: z.number().min(0).max(1) })).min(1).max(3),
})
export const DetectedItemSchema = v1.DetectedItemSchema.omit({ fields: true, categoryId: true, unreadFields: true, bbox: true }).extend({
  categoryId: z.enum(CATEGORY_IDS).nullable(), fields: FieldsSchema,
  fieldSources: z.partialRecord(FieldKeySchema, FieldSourceSchema),
  unreadFields: z.array(FieldKeySchema).max(FIELD_KEYS.length),
  identification: z.enum(['label_read', 'ai_estimated']), estimate: EstimateSchema.optional(),
  imageId: v1.IdSchema,
  bbox: v1.DetectedItemSchema.shape.bbox.describe('imageId의 전송 이미지 기준 정규화 [x,y,width,height]. 크롭/재인코딩 전 원본 좌표가 아님.'),
})
export const ItemInfoSchema = DetectedItemSchema.extend({ confirmed: z.boolean(), userEdited: z.boolean() })
export const InputImageSchema = v1.ImageSchema.extend({ id: v1.IdSchema, kind: z.enum(['overview', 'closeup', 'label']), cropped: z.boolean().optional() })
export const RecognizeRequestSchema = z.discriminatedUnion('captureMode', [
  z.strictObject({ captureMode: z.literal('overview'), images: z.array(InputImageSchema).length(1) }),
  z.strictObject({ captureMode: z.literal('detail'), mode: z.enum(['label', 'estimate']), images: z.array(InputImageSchema).min(1).max(LIMITS.maxImages), targetItemId: v1.IdSchema.optional() }),
])
export const MetaSchema = z.strictObject({
  contractVersion: z.literal(CONTRACT_VERSION), isDemoRecognition: z.boolean(), isDemoRules: z.boolean(), isDemoLookup: z.boolean(),
})
export const QualitySchema = z.strictObject({
  imageId: v1.IdSchema, source: z.enum(['demo', 'ai', 'local']), usable: z.boolean().nullable(),
  issues: z.array(z.enum(['blur', 'glare', 'too_far', 'cropped_text', 'dark', 'no_label_found'])).max(6),
})
export const RecognizeResponseSchema = z.strictObject({
  captureMode: CaptureModeSchema, items: z.array(DetectedItemSchema).max(LIMITS.maxItems),
  imageQuality: z.array(QualitySchema).min(1).max(LIMITS.maxImages),
  suggestRetake: z.boolean(), suggestEstimateMode: z.boolean(), multipleItemsDetected: z.boolean(), needsLabelPhoto: z.boolean(),
  warnings: z.array(z.strictObject({ code: z.enum(['DEMO_RESPONSE', 'NO_ITEM_DETECTED', 'MULTIPLE_ITEMS', 'POOR_IMAGE', 'NO_LABEL_FOUND']), message: shortText(400) })).max(5),
  meta: MetaSchema,
})
export const LookupRequestSchema = z.strictObject({
  itemId: v1.IdSchema, categoryId: z.enum(CATEGORY_IDS).nullable(), modelName: shortText(), brand: shortText().nullable(),
})
export const CandidateSchema = z.strictObject({
  id: v1.IdSchema, itemId: v1.IdSchema, name: shortText(), fields: FieldsSchema,
  sources: z.array(v1.SourceSchema).min(1).max(5), confidence: z.number().min(0).max(1), requiresConfirmation: z.literal(true),
})
export const LookupResponseSchema = z.strictObject({ itemId: v1.IdSchema, candidates: z.array(CandidateSchema).max(5), message: shortText(400), meta: MetaSchema })
export const EvaluateRequestSchema = z.strictObject({
  airlineId: v1.IdSchema, flightType: FlightTypeSchema, departureCountry: z.literal(DEPARTURE_COUNTRY), items: z.array(ItemInfoSchema).min(1).max(LIMITS.maxItems),
})
export const DerivedWhSchema = z.strictObject({
  value: z.number().positive(), displayValue: z.number().nonnegative(), basis: z.literal('mah*volts/1000'), source: z.literal('calculated'),
})
export const ItemResultSchema = v1.ItemResultSchema.omit({ missingFields: true }).extend({
  missingFields: z.array(FieldKeySchema).max(FIELD_KEYS.length), derivedFields: z.strictObject({ wh: DerivedWhSchema.optional() }),
})
export const EvaluateResponseSchema = z.strictObject({
  airlineId: v1.IdSchema, flightType: FlightTypeSchema, departureCountry: z.literal(DEPARTURE_COUNTRY), ruleVersion: shortText().nullable(),
  results: z.array(ItemResultSchema).min(1).max(LIMITS.maxItems), meta: MetaSchema,
})
export const HealthResponseSchema = v1.HealthResponseSchema.omit({ meta: true }).extend({ meta: MetaSchema })
export const AirlineSchema = v1.AirlineSchema.extend({ supportedFlightTypes: z.array(FlightTypeSchema).min(1).max(2) })
export const AirlinesResponseSchema = z.strictObject({ airlines: z.array(AirlineSchema), meta: MetaSchema })
export const CategoriesQuerySchema = z.strictObject({ airlineId: v1.IdSchema, flightType: FlightTypeSchema, departureCountry: z.literal(DEPARTURE_COUNTRY) })
export const CategorySchema = z.strictObject({
  id: z.enum(CATEGORY_IDS), label: shortText(),
  requiredFields: z.strictObject({ cabin: z.array(FieldKeySchema), checked: z.array(FieldKeySchema) }),
  estimatePolicy: z.enum(['never_definitive', 'allowed_with_confirm']),
})
export const CategoriesResponseSchema = CategoriesQuerySchema.extend({ categories: z.array(CategorySchema).max(CATEGORY_IDS.length), meta: MetaSchema })
export const MetaResponseSchema = z.strictObject({
  meta: MetaSchema,
  capabilities: z.strictObject({ recognition: z.enum(['demo', 'gemini', 'unavailable']), productLookup: z.enum(['demo', 'gemini', 'unavailable']), evaluation: z.enum(['stub', 'rules', 'unavailable']) }),
  supportedCaptureModes: z.array(CaptureModeSchema), supportedFlightTypes: z.array(FlightTypeSchema),
  supportedDepartureCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1),
  plannedAirlineId: z.literal('korean-air'),
  limits: v1.MetaResponseSchema.shape.limits.extend({ maxImages: z.int(), overviewImages: z.int() }),
  labels: z.strictObject({
    title: z.string(), verdicts: v1.MetaResponseSchema.shape.labels.shape.verdicts,
    actions: v1.MetaResponseSchema.shape.labels.shape.actions, fields: z.record(FieldKeySchema, z.string()),
    sources: z.record(z.enum(['label', 'user', 'calculated', 'lookup']), z.string()),
    flightTypes: z.record(FlightTypeSchema, z.string()), captureModes: z.record(CaptureModeSchema, z.string()),
    demoBanner: z.string(), stubBanner: z.string(), referenceNotice: z.string(), productNotice: z.string(), photoNotice: z.string(),
  }),
})
export const CatalogCardSchema = z.strictObject({
  id: v1.IdSchema, photoKeys: z.array(v1.IdSchema).min(1).max(LIMITS.maxImages),
  item: ItemInfoSchema, result: ItemResultSchema, airline: AirlineSchema, flightType: FlightTypeSchema, departureCountry: z.literal(DEPARTURE_COUNTRY),
  productSources: z.array(v1.SourceSchema).max(5), savedAt: z.iso.datetime(), evaluatedAt: z.iso.datetime(),
  ruleVersion: shortText().nullable(), meta: MetaSchema,
})

export function assertItemSemantics(item: z.infer<typeof DetectedItemSchema>) {
  if (new Set(item.unreadFields).size !== item.unreadFields.length) throw new Error('duplicate unreadFields')
  for (const field of FIELD_KEYS) {
    const source = item.fieldSources[field]
    if ((item.fields[field] === null) !== item.unreadFields.includes(field)) throw new Error('unreadFields mismatch')
    if ((item.fields[field] !== null) !== (source !== undefined)) throw new Error('field source mismatch')
    if (!source) continue
    if (source.source === 'label' && !source.imageId) throw new Error('label image required')
    if (source.source === 'lookup' && !source.sourceUrl) throw new Error('lookup source required')
    if (source.source === 'user' && !source.confirmed) throw new Error('user input must be confirmed')
    if (source.source === 'calculated' && (field !== 'wh' || source.basis !== 'mah*volts/1000' || item.fields.mah === null || item.fields.volts === null || item.fieldSources.volts?.voltageType !== 'nominal')) throw new Error('invalid calculation basis')
    if (source.source === 'calculated' && item.fields.wh !== item.fields.mah! * item.fields.volts! / 1000) throw new Error('calculated value mismatch')
    if (source.voltageType !== undefined && field !== 'volts') throw new Error('voltageType belongs to volts')
  }
  if (item.identification === 'ai_estimated' && !item.estimate) throw new Error('estimate required')
  if (item.identification === 'label_read' && item.estimate) throw new Error('estimate forbidden for label_read')
  if (item.bbox && (item.bbox[0] + item.bbox[2] > 1 || item.bbox[1] + item.bbox[3] > 1)) throw new Error('bbox bounds')
}
export function assertRecognizeRequest(input: z.infer<typeof RecognizeRequestSchema>) {
  if (new Set(input.images.map(image => image.id)).size !== input.images.length) throw new Error('duplicate image id')
  if (input.captureMode === 'overview') {
    if (input.images[0]!.kind !== 'overview') throw new Error('overview image required')
  } else {
    if (input.images.some(image => image.kind === 'overview')) throw new Error('overview image in detail')
    if (input.mode === 'label' && !input.images.some(image => image.kind === 'label')) throw new Error('label image required')
    if (input.mode === 'estimate' && !input.images.some(image => image.kind === 'closeup')) throw new Error('closeup image required')
  }
}
export function assertItems(items: z.infer<typeof DetectedItemSchema>[]) {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('duplicate item id')
  items.forEach(assertItemSemantics)
}
export function assertRecognizeResponse(input: z.infer<typeof RecognizeRequestSchema>, output: z.infer<typeof RecognizeResponseSchema>) {
  assertItems(output.items)
  const imageIds = new Set(input.images.map(image => image.id))
  if (output.captureMode !== input.captureMode) throw new Error('capture mode mismatch')
  if (output.imageQuality.length !== input.images.length || new Set(output.imageQuality.map(q => q.imageId)).size !== input.images.length || output.imageQuality.some(q => !imageIds.has(q.imageId))) throw new Error('image quality mismatch')
  if (output.items.some(item => !imageIds.has(item.imageId) || Object.values(item.fieldSources).some(source => source?.imageId && !imageIds.has(source.imageId)))) throw new Error('unknown source image')
  if (input.captureMode === 'detail') {
    if (output.items.length > 1 || (output.multipleItemsDetected && output.items.length)) throw new Error('detail item count')
    if (input.targetItemId && output.items.some(item => item.id !== input.targetItemId)) throw new Error('target item mismatch')
    if (output.items.some(item => item.identification !== (input.mode === 'label' ? 'label_read' : 'ai_estimated'))) throw new Error('identification mismatch')
  }
}
export const operationSchemas = {
  health: { response: HealthResponseSchema }, meta: { response: MetaResponseSchema },
  airlines: { response: AirlinesResponseSchema }, categories: { request: CategoriesQuerySchema, response: CategoriesResponseSchema },
  recognize: { request: RecognizeRequestSchema, response: RecognizeResponseSchema },
  lookup: { request: LookupRequestSchema, response: LookupResponseSchema }, evaluate: { request: EvaluateRequestSchema, response: EvaluateResponseSchema },
} as const
