import type { z } from 'zod'
import type * as s from './schemas.ts'
export type Verdict = z.infer<typeof s.VerdictSchema>
export type Action = z.infer<typeof s.ActionSchema>
export type Fields = z.infer<typeof s.FieldsSchema>
export type FieldKey = z.infer<typeof s.FieldKeySchema>
export type DetectedItem = z.infer<typeof s.DetectedItemSchema>
export type ItemInfo = z.infer<typeof s.ItemInfoSchema>
export type ItemResult = z.infer<typeof s.ItemResultSchema>
export type Meta = z.infer<typeof s.MetaSchema>
export type RecognizeRequest = z.infer<typeof s.RecognizeRequestSchema>
export type RecognizeResponse = z.infer<typeof s.RecognizeResponseSchema>
export type ResolveProductRequest = z.infer<typeof s.ResolveProductRequestSchema>
export type ResolveProductResponse = z.infer<typeof s.ResolveProductResponseSchema>
export type EvaluateRequest = z.infer<typeof s.EvaluateRequestSchema>
export type EvaluateResponse = z.infer<typeof s.EvaluateResponseSchema>
export type ErrorCode = z.infer<typeof s.ErrorCodeSchema>
export type Source = z.infer<typeof s.SourceSchema>
export type CatalogCard = z.infer<typeof s.CatalogCardSchema>
