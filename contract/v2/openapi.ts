import { API_PREFIX, CONTRACT_VERSION } from './constants.ts'
import { CatalogCardSchema, operationSchemas } from './schemas.ts'
import { buildVersionedOpenApi } from '../openapi-builder.ts'

export function buildOpenApi() {
  return buildVersionedOpenApi({
    version: CONTRACT_VERSION, prefix: API_PREFIX, operations: operationSchemas, catalogCard: CatalogCardSchema,
    description: '2.0.0 호환 확장. 사진 인식·제품 조회는 시연. 대한항공 직접 운항·한국 출발·1명 기준의 검수 규정 판정 지원. 선택 입력 details·inventoryComplete와 /rules 추가. mode/이미지 kind/출처/ID/추가정보 관계 등 의미 제약은 README와 런타임 검증을 함께 준수.',
  })
}
