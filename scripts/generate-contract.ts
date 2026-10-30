import { writeFile } from 'node:fs/promises'
import { buildOpenApi } from '../contract/openapi.ts'

// JSON은 YAML 1.2의 부분집합. 추가 YAML 변환 의존성 없이 같은 명세 제공.
await writeFile(new URL('../contract/openapi.yaml', import.meta.url), `${JSON.stringify(buildOpenApi(), null, 2)}\n`)
