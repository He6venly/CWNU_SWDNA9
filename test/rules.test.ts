import { describe, expect, it } from 'vitest'
import { parseAirlineRules } from '../contract/rules.ts'

const sample = () => ({
  airlineId: 'demo-airline', isDemo: true, note: '테스트용 임의 수치. 실제 규정 아님.', updatedAt: '2026-10-30', sourceUrl: null,
  rules: [{ categoryId: 'power-bank', label: '시연 보조배터리',
    cabin: { base: 'ALLOWED', requiredFields: ['wh'], explanation: '시연', conditions: [
      { field: 'wh', op: '<=', value: 10, resultIfMet: 'ALLOWED', note: '시연' },
      { field: 'wh', op: '>', value: 10, resultIfMet: 'CONDITIONAL', note: '시연' },
    ] },
    checked: { base: 'PROHIBITED', requiredFields: [], explanation: '시연', conditions: [] },
  }],
})
describe('규정 데이터 계약 — 판정 엔진과 독립', () => {
  it('경계가 겹치지 않는 상보 조건 허용', () => { expect(parseAirlineRules(sample()).rules).toHaveLength(1) })
  it('동일 경계가 양쪽에 포함되면 거부', () => {
    const value = sample(); value.rules[0]!.cabin.conditions[1]!.op = '>='
    expect(() => parseAirlineRules(value)).toThrow('중첩')
  })
  it('필수 필드 미등록·중복 카테고리·실제 출처 없음 거부', () => {
    const value = sample(); value.rules[0]!.cabin.requiredFields = []
    expect(() => parseAirlineRules(value)).toThrow()
    const duplicate = sample(); duplicate.rules.push(duplicate.rules[0]!)
    expect(() => parseAirlineRules(duplicate)).toThrow('중복')
    expect(() => parseAirlineRules({ ...sample(), isDemo: false })).toThrow('출처')
  })
})
