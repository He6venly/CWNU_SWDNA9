import { writeFile } from 'node:fs/promises'
import { buildOpenApi } from '../contract/openapi.ts'
import { buildOpenApi as buildV2 } from '../contract/v2/openapi.ts'
import requests from '../contract/v2/fixtures/requests.json' with { type: 'json' }
import { RecognizeRequestSchema } from '../contract/v2/schemas.ts'
import { recognizeDemo } from '../contract/v2/demo.ts'
import type { RecognitionScenario } from '../contract/v2/demo.ts'
import { ruleMetadata } from '../netlify/functions/_lib/rules/korean-air.ts'

// JSON은 YAML 1.2의 부분집합. 추가 YAML 변환 의존성 없이 같은 명세 제공.
await writeFile(new URL('../contract/openapi.yaml', import.meta.url), `${JSON.stringify(buildOpenApi(), null, 2)}\n`)
await writeFile(new URL('../contract/v2/openapi.yaml', import.meta.url), `${JSON.stringify(buildV2(), null, 2)}\n`)

// 스텁 응답 예시 산출물. 실제 규정 엔진의 정답/기대값으로 사용하지 않음.
const cases: Array<[string, keyof typeof requests, RecognitionScenario]> = [
  ['overview', 'overview', 'standard'], ['label', 'label', 'standard'], ['estimate', 'estimate', 'standard'],
  ['empty', 'label', 'empty'], ['multiple', 'label', 'multiple'], ['no-label', 'label', 'no-label'],
  ['blur', 'label', 'blur'], ['risk-estimate', 'estimate', 'risk-estimate'], ['low-confidence', 'estimate', 'low-confidence'],
]
const examples = Object.fromEntries(cases.map(([id, requestName, scenario]) => {
  const request = RecognizeRequestSchema.parse(requests[requestName])
  return [id, { request, response: recognizeDemo(request, scenario) }]
}))
await writeFile(new URL('../contract/v2/fixtures/responses.json', import.meta.url), `${JSON.stringify(examples, null, 2)}\n`)
const rules = ruleMetadata(new Date('2026-10-30T00:00:00Z'))
await writeFile(new URL('../contract/v2/fixtures/rules.json', import.meta.url), `${JSON.stringify({ ...rules, current: false, ruleVersion: null, meta: { ...rules.meta, isDemoRules: true } }, null, 2)}\n`)
