import recognized from './fixtures/recognize.json' with { type: 'json' }
import previews from './fixtures/evaluation-previews.json' with { type: 'json' }
import errors from './fixtures/errors.json' with { type: 'json' }
import { DEMO_AIRLINE_ID } from './constants.ts'
import { ItemResultSchema, RecognizeResponseSchema } from './schemas.ts'
import type { EvaluateRequest } from './types.ts'

export const recognitionExample = RecognizeResponseSchema.parse(recognized)
export const resultPreviews = previews.map(p => ({ ...p, result: ItemResultSchema.parse(p.result) }))
export const errorExamples = errors
export const evaluateExample: EvaluateRequest = {
  airlineId: DEMO_AIRLINE_ID,
  items: recognitionExample.items.map(item => ({ ...item, confirmed: false, userEdited: false })),
}
export const emptyRecognitionExample = { ...recognitionExample, items: [] }
