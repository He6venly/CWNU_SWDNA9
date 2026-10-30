import { CONTRACT_VERSION } from './constants.ts'
import { CatalogCardSchema, operationSchemas } from './schemas.ts'
import { buildVersionedOpenApi } from './openapi-builder.ts'

export function buildOpenApi() {
  return buildVersionedOpenApi({ version: CONTRACT_VERSION, prefix: '/api', operations: operationSchemas,
    catalogCard: CatalogCardSchema, description: '기존 1.0.0 시연 API. 새 프론트는 /api/v2 사용. 실제 Gemini·최신 규정 미연결. 상세: contract/README.md' })
}
