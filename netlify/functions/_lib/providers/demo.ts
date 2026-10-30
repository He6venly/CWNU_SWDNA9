import { recognitionExample } from '../../../../contract/examples.ts'
import { demoMeta } from '../../../../contract/data.ts'
import type { EvaluateRequest, EvaluateResponse, ResolveProductRequest, ResolveProductResponse } from '../../../../contract/types.ts'

export function recognizeDemo() { return structuredClone(recognitionExample) }
export function resolveProductDemo({ item }: ResolveProductRequest): ResolveProductResponse {
  return {
    itemId: item.id, status: item.fields.modelName === null ? 'NEEDS_INFO' : 'NOT_FOUND', candidates: [],
    missingFields: item.fields.modelName === null ? ['modelName'] : [],
    message: '시연용 고정 응답입니다. 실제 제품 검색은 아직 연결되지 않았습니다.', meta: demoMeta,
  }
}
export function evaluateStub({ items }: EvaluateRequest): EvaluateResponse {
  return {
    results: items.map(item => ({
      itemId: item.id,
      cabin: { verdict: 'NEEDS_INFO', reason: `${item.confirmed ? '' : '사용자 확인 전. '}시연용 고정 응답입니다. 판정 엔진 연결이 필요합니다.` },
      checked: { verdict: 'NEEDS_INFO', reason: `${item.confirmed ? '' : '사용자 확인 전. '}시연용 고정 응답입니다. 판정 엔진 연결이 필요합니다.` },
      action: 'CHECK_CONDITIONS', missingFields: [],
      staffSummary: '제품 정보 미확인 / 기내: 제품 정보 확인 필요 / 위탁: 제품 정보 확인 필요 / 시연용 고정 응답', isDemo: true,
    })), meta: demoMeta,
  }
}
