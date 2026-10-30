# 계약 변경 기록

## 2.0.0 병행 제공 — 2026-10-30

- 새 모듈은 contract/v2, API는 /api/v2. 상세는 v2/CHANGELOG.md
- 기존 1.0.0 요청·응답 및 /api 경로 유지. OpenAPI 생성 코드만 공통화

## 1.0.0 — 2026-10-30

- 최초 프론트 인계 계약
- health 포함 모든 성공 응답에 meta 명시, 오류 형식 통일
- 판정·조치 enum 유지, null/unreadFields·단위·bbox·ID·배열 한도 정의
- 기내·위탁 requiredFields 분리, 중첩된 규정 조건 거부 기준 정의
- Gemini 제품 정보 검색을 위한 POST /api/resolve-product 추가. 제품 후보·출처·사용자 확인 상태 정의
- /api/meta에 capabilities를 추가해 시연·스텁·미연결 상태를 구분
- IndexedDB 도감용 CatalogCardSchema 제공. 서버 저장 API는 포함하지 않음
- 실제 API 고정 응답과 디자인용 결과 목업을 구분
