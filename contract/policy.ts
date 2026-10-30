import type { Action, Verdict } from './types.ts'

// 권장 조치의 계약상 우선순위. 실제 규정 판정과는 별개.
export function deriveAction(cabin: Verdict, checked: Verdict): Action {
  if (cabin === 'PROHIBITED' && checked === 'PROHIBITED') return 'LEAVE_BEHIND'
  if (cabin === 'ALLOWED') return 'PUT_IN_CABIN'
  if (checked === 'ALLOWED') return 'PUT_IN_CHECKED'
  return 'CHECK_CONDITIONS'
}
