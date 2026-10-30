import type { z } from 'zod'
import type * as s from './schemas.ts'
export type Fields = z.infer<typeof s.FieldsSchema>
export type FieldKey = z.infer<typeof s.FieldKeySchema>
export type FieldSource = z.infer<typeof s.FieldSourceSchema>
export type DetectedItem = z.infer<typeof s.DetectedItemSchema>
export type ItemInfo = z.infer<typeof s.ItemInfoSchema>
export type ItemResult = z.infer<typeof s.ItemResultSchema>
export type FlightType = z.infer<typeof s.FlightTypeSchema>
export type RecognizeRequest = z.infer<typeof s.RecognizeRequestSchema>
export type RecognizeResponse = z.infer<typeof s.RecognizeResponseSchema>
export type LookupRequest = z.infer<typeof s.LookupRequestSchema>
export type LookupResponse = z.infer<typeof s.LookupResponseSchema>
export type EvaluateRequest = z.infer<typeof s.EvaluateRequestSchema>
export type EvaluateResponse = z.infer<typeof s.EvaluateResponseSchema>
export type CatalogCard = z.infer<typeof s.CatalogCardSchema>
export type Airline = z.infer<typeof s.AirlineSchema>
export type { ResultPresentation, ConditionCode } from './presentation.ts'
