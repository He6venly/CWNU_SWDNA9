import { API_PREFIX, CONTRACT_VERSION } from './constants.ts'
import { CatalogCardSchema, operationSchemas } from './schemas.ts'
import { buildVersionedOpenApi } from '../openapi-builder.ts'

export function buildOpenApi() {
  return buildVersionedOpenApi({
    version: CONTRACT_VERSION, prefix: API_PREFIX, operations: operationSchemas, catalogCard: CatalogCardSchema,
    description: '2.0.0 확장. 기본 사진 인식·제품 조회는 시연, 실제 Gemini 호출 잠금. 대한항공 한국 출발·1명 규정 판정. identification=manual은 사진 없는 사용자 입력. resultFormat=detailed 요청에만 presentation 조건·추가정보·근거·영문 요약 반환. 도감은 브라우저 로컬 저장. 의미 제약은 README와 런타임 검증 준수.',
  })
}
