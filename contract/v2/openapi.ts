import { API_PREFIX, CONTRACT_VERSION } from './constants.ts'
import { CatalogCardSchema, operationSchemas } from './schemas.ts'
import { buildVersionedOpenApi } from '../openapi-builder.ts'

export function buildOpenApi() {
  return buildVersionedOpenApi({
    version: CONTRACT_VERSION, prefix: API_PREFIX, operations: operationSchemas, catalogCard: CatalogCardSchema,
    description: '2.0.0 시연 API. 전체/개별 기존 사진 등록·필드 출처·국내/국제 구분. 실제 인식·제품 조회·최종 규정 엔진 미연결. mode/이미지 kind/출처/ID 관계 등 의미 제약은 README와 런타임 검증을 함께 준수.',
  })
}
