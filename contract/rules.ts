import { z } from 'zod'
import { CATEGORY_IDS } from './constants.ts'
import { FieldKeySchema, IdSchema, VerdictSchema } from './schemas.ts'

const numericField = z.enum(['wh', 'ml', 'count'])
const common = { field: numericField, resultIfMet: VerdictSchema, note: z.string().min(1).max(600) }
const comparison = z.strictObject({ ...common, op: z.enum(['<', '<=', '>', '>=']), value: z.number().finite() })
const between = z.strictObject({ ...common, op: z.literal('between'), value: z.tuple([z.number().finite(), z.number().finite()]) })
export const RuleConditionSchema = z.union([comparison, between])
export const RuleSideSchema = z.strictObject({
  base: z.enum(['ALLOWED', 'CONDITIONAL', 'PROHIBITED']), requiredFields: z.array(FieldKeySchema),
  conditions: z.array(RuleConditionSchema).max(20), explanation: z.string().min(1).max(600),
})
export const AirlineRulesSchema = z.strictObject({
  airlineId: IdSchema, isDemo: z.boolean(), note: z.string().min(1), updatedAt: z.iso.date(),
  sourceUrl: z.url().regex(/^https:\/\//).nullable(),
  rules: z.array(z.strictObject({ categoryId: z.enum(CATEGORY_IDS), label: z.string().min(1), cabin: RuleSideSchema, checked: RuleSideSchema })).max(CATEGORY_IDS.length),
})
export type AirlineRules = z.infer<typeof AirlineRulesSchema>

function interval(condition: z.infer<typeof RuleConditionSchema>) {
  if (condition.op === 'between') return { low: condition.value[0], high: condition.value[1], lowInclusive: true, highInclusive: true }
  const upper = condition.op === '<' || condition.op === '<='
  return { low: upper ? -Infinity : condition.value, high: upper ? condition.value : Infinity, lowInclusive: condition.op === '>=', highInclusive: condition.op === '<=' }
}
export function parseAirlineRules(value: unknown): AirlineRules {
  const rules = AirlineRulesSchema.parse(value)
  if (!rules.isDemo && !rules.sourceUrl) throw new Error('실제 규정에는 출처 URL 필요')
  if (new Set(rules.rules.map(r => r.categoryId)).size !== rules.rules.length) throw new Error('중복 카테고리')
  for (const category of rules.rules) for (const side of [category.cabin, category.checked]) {
    if (new Set(side.requiredFields).size !== side.requiredFields.length) throw new Error('중복 필수 필드')
    for (const condition of side.conditions) {
      if (!side.requiredFields.includes(condition.field)) throw new Error('조건 필드는 필수 필드에 포함 필요')
      const bounds = interval(condition)
      if (bounds.low > bounds.high) throw new Error('잘못된 between 범위')
    }
    for (let i = 0; i < side.conditions.length; i++) for (let j = i + 1; j < side.conditions.length; j++) {
      const first = side.conditions[i]!, second = side.conditions[j]!
      if (first.field !== second.field) throw new Error('MVP 조건은 한쪽 판정에서 동일 필드만 비교')
      const a = interval(first), b = interval(second)
      const disjoint = a.high < b.low || b.high < a.low ||
        (a.high === b.low && !(a.highInclusive && b.lowInclusive)) || (b.high === a.low && !(b.highInclusive && a.lowInclusive))
      if (!disjoint) throw new Error('중첩된 규정 조건')
    }
  }
  return rules
}
