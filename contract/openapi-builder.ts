import { z } from 'zod'
import { ErrorResponseSchema } from './schemas.ts'

export function buildVersionedOpenApi({ version, prefix, operations, catalogCard, description }: {
  version: string; prefix: string; operations: Record<string, { request?: z.ZodType; response: z.ZodType }>;
  catalogCard: z.ZodType; description: string;
}) {
  const paths: Record<string, unknown> = {}
  const components: Record<string, unknown> = { ErrorResponse: z.toJSONSchema(ErrorResponseSchema), CatalogCard: z.toJSONSchema(catalogCard) }
  for (const [id, schemas] of Object.entries(operations)) {
    const path = id === 'resolveProduct' ? 'resolve-product' : id
    const post = ['recognize', 'resolveProduct', 'lookup', 'evaluate'].includes(id)
    const query = !post && schemas.request ? z.toJSONSchema(schemas.request) as { properties: Record<string, unknown>; required: string[] } : undefined
    components[`${id}Response`] = z.toJSONSchema(schemas.response)
    if (schemas.request) components[`${id}Request`] = z.toJSONSchema(schemas.request)
    const json = (name: string) => ({ 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } })
    const errors = Object.fromEntries([400, 403, 404, 405, 408, 409, 413, 415, 429, 500, 502, 503, 504].map(status => [status, {
      description: '공통 오류. 플랫폼 자체 차단 응답은 이 형식이 아닐 수 있음.', content: json('ErrorResponse'),
    }]))
    paths[`${prefix}/${path}`] = { [post ? 'post' : 'get']: {
      operationId: id,
      ...(post && schemas.request ? { requestBody: { required: true, content: json(`${id}Request`) } } : {}),
      ...(query ? { parameters: Object.entries(query.properties).map(([name, schema]) => ({ in: 'query', name, required: query.required.includes(name), schema })) } : {}),
      responses: { '200': { description: '성공. meta에 계약 버전·시연 상태 포함.', content: json(`${id}Response`) }, ...errors },
    } }
  }
  return { openapi: '3.1.0', info: { title: '여행 짐 반입 확인 API', version, description }, servers: [{ url: 'http://localhost:5173', description: '로컬 체크 화면·API' }], paths, components: { schemas: components } }
}
