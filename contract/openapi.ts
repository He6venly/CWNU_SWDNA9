import { z } from 'zod'
import { CONTRACT_VERSION } from './constants.ts'
import { CatalogCardSchema, ErrorResponseSchema, operationSchemas } from './schemas.ts'

export function buildOpenApi() {
  const paths: Record<string, unknown> = {}
  const components: Record<string, unknown> = { ErrorResponse: z.toJSONSchema(ErrorResponseSchema), CatalogCard: z.toJSONSchema(CatalogCardSchema) }
  for (const [id, schemas] of Object.entries(operationSchemas)) {
    const path = id === 'resolveProduct' ? 'resolve-product' : id
    const post = ['recognize', 'resolveProduct', 'evaluate'].includes(id)
    const responseName = `${id}Response`
    components[responseName] = z.toJSONSchema(schemas.response)
    if ('request' in schemas) components[`${id}Request`] = z.toJSONSchema(schemas.request)
    const responses = Object.fromEntries([400, 403, 404, 405, 408, 409, 413, 415, 429, 500, 502, 503, 504].map(status => [status, {
      description: '공통 오류 형식. 플랫폼 자체 차단 응답은 이 형식이 아닐 수 있음.',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
    }]))
    paths[`/api/${path}`] = { [post ? 'post' : 'get']: {
      operationId: id,
      ...(post && 'request' in schemas ? { requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${id}Request` } } } } } : {}),
      ...(id === 'categories' ? { parameters: [{ in: 'query', name: 'airlineId', required: true, schema: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$', minLength: 1, maxLength: 80 } }] } : {}),
      responses: { '200': { description: '성공. meta는 시연 플래그와 계약 버전 포함.', content: { 'application/json': { schema: { $ref: `#/components/schemas/${responseName}` } } } }, ...responses },
    } }
  }
  return {
    openapi: '3.1.0', info: { title: '여행 짐 반입 확인 API', version: CONTRACT_VERSION,
      description: 'B1 스텁. 실제 Gemini·최신 규정 미연결. resolve-product는 명시적 제품 조회 단계. fields의 null과 unreadFields 일치, bbox 좌표 합 상한, ID 고유성은 서버 의미 검증. 상세: contract/README.md' },
    servers: [{ url: 'http://localhost:5173', description: '로컬 체크 화면·API' }], paths, components: { schemas: components },
  }
}
