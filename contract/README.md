# 프론트·백엔드 계약 1.0.0

> 이 문서는 기존 1.0.0 계약. 새 사진 등록·필드 출처·노선 구분 계약은 contract/v2/README.md, 경로는 /api/v2. 실제 인식·조회·순수 규정 판정은 양쪽 모두 미연결. 프론트 이행 전 1.0 API는 유지.

임시 제목: 여행 짐 반입 확인. 사용자용 디자인·사진 촬영·도감 저장은 프론트 담당, API·이 계약·체크 화면은 백엔드 담당 범위.

## 파일 기준

- schemas.ts: JSON 구조의 단일 기준. types.ts는 해당 스키마에서 타입 유도
- openapi.yaml: 스키마에서 생성한 OpenAPI 3.1. JSON 표기의 YAML 1.2 문서. 직접 수정하지 않음
- labels.ts: 공통 한국어 표시 문구. meta 응답에도 같은 문구 제공
- client.ts / mock.ts: 실서버·목업에 같은 ApiClient 인터페이스 제공
- fixtures/: 사진과 무관한 시연 인식 4개, 결과 6종, 구조화 오류 JSON
- rules.ts / policy.ts: 기내·위탁별 규정 데이터 형식과 권장 조치 우선순위. 실제 항공사 규정 파일·완성된 판정 엔진이 아님
- CHANGELOG.md: 계약 변경 기록

## 현재 기능 상태

| 구분 | 현재 | 연결 경계 |
| --- | --- | --- |
| recognize | 이미지 내용과 무관한 고정 4개 반환 | Gemini 사진·라벨 인식 어댑터 |
| resolve-product | 빈 후보·정보 입력 요청 또는 미발견 반환 | Gemini 검색 grounding 기반 제품 후보 조회 |
| evaluate | 모든 항목 NEEDS_INFO, 실제 판정 없음 | Gemini 제품 정보·항공사 규정 대조 어댑터 |
| 도감 | 저장 형식만 제공 | 프론트 IndexedDB에서 사진·카드 저장 |

서버의 /api/meta.capabilities.evaluation은 현재 stub. 고정 목업의 ALLOWED 등을 실제 판정으로 표시하지 않아야 함. 모든 시연 플래그는 true. 실제 제공자 전환은 B3에서 진행하며 환경변수만 추가해도 현재 공개 API가 유료 호출을 시작하지 않는 구성.

## API

| 메서드 | 경로 | 요청 | 성공 응답 |
| --- | --- | --- | --- |
| GET | /api/health | 없음 | {ok,time,meta} |
| GET | /api/meta | 없음 | {meta,labels,capabilities,limits} |
| GET | /api/airlines | 없음 | {airlines,meta} |
| GET | /api/categories?airlineId= | 항공사 ID | {airlineId,categories,meta} |
| POST | /api/recognize | {airlineId,image:{mimeType,base64}} | {items,meta} |
| POST | /api/resolve-product | {airlineId,item} | {itemId,status,candidates,missingFields,message,meta} |
| POST | /api/evaluate | {airlineId,items} | {results,meta} |

모든 성공 응답에 meta:{isDemoRecognition,isDemoRules,contractVersion}. 오류는 {error:{code,message}}이며 meta 없음. 성공 status는 200. 허용된 OPTIONS 사전 요청은 본문 없는 204.

## 입력·출력 의미

- 알 수 없는 제품 값은 null. fields의 modelName,wh,mah,volts,ml,count 6개 키는 항상 포함. 0·빈 문자열로 null을 대체하지 않음
- unreadFields는 null인 fields의 키와 정확히 일치하며 중복 없음. 사용자가 값 수정 시 같이 갱신
- confidence는 0~1. bbox는 선택 값이며 원본 기준 정규화 [x,y,width,height]. 좌상단 원점, x+width·y+height는 1 이하. 인식이 불확실하면 bbox 생략
- categoryId는 정의된 5종 또는 null. 모르는 물품을 임의 카테고리에 끼워 넣지 않음
- 모델명은 120자 이하. 단위는 Wh/mAh/V/mL/개. 수량은 1~100 정수, 나머지는 양수. 숫자 문자열 자동 변환·모델명 추측·수치 자동 보정 없음
- items는 1~30개, id는 요청 안에서 고유. 인식 응답 items는 0개 허용
- confirmed는 사용자가 물품과 정보를 확인했는지 여부. userEdited는 사용자가 변경했는지 여부. AI 신뢰도와 별개
- 제품 검색은 인식과 별도 단계. status는 NEEDS_INFO/CANDIDATES_FOUND/NOT_FOUND. 후보의 requiresConfirmation은 항상 true. 제품 출처 URL·조회 시각과 함께 표시하고 사용자가 수락한 값만 ItemInfo에 반영
- 검색으로 찾은 모델과 사진의 모델 일치 여부는 사용자 확인 필요. 제품 후보는 규정 판정이 아님
- 결과는 itemId로 입력 물품과 매칭. 배열 순서에 의존하지 않음. missingFields는 null인 모든 키가 아니라 판정에 실제 필요한 추가 필드. 규칙이 없으면 빈 배열이어도 NEEDS_INFO 가능
- 수정·항공사 변경·새 사진 등록 시 이전 판정 폐기. 재판정 완료 전에 저장·확정하지 않음
- 사진은 프론트에 보관. 직원용 요약은 참고용 데이터이며 공항의 최종 결정을 대신하지 않음

## 판정 의미 — B2/B3 구현 기준

- 기내·위탁 requiredFields는 각각 정의. 정보가 없어도 독립적으로 확정된 불가는 유지
- category 규칙이 없으면 양쪽 NEEDS_INFO. 미확인 제품은 reason에 사용자 확인 전 표시
- between은 양 끝 포함. 조건이 없으면 base, 조건이 충족되면 해당 resultIfMet
- MVP는 한쪽 판정의 조건들이 동일한 수치 필드를 비교하며 범위가 겹치지 않아야 함. 중첩·역전된 구간·중복 카테고리·필수 필드 미등록은 데이터 로드 시 거부. 순서에 따라 결과가 바뀌지 않는 구조
- 양쪽 불가 → LEAVE_BEHIND, 기내 ALLOWED → PUT_IN_CABIN, 위탁 ALLOWED → PUT_IN_CHECKED, 나머지 → CHECK_CONDITIONS 순서
- 시연 규정은 isDemo:true. 실제 규정은 출처 URL·확인 날짜가 필수이며, 형식 검증과 실제 최신성 검증을 구분
- 생성된 reason·staffSummary에서 단정적 금지어 검사. 고정 부정 안내는 별도 문구 검증. 사용자 입력 영역의 원문을 생성된 보증 문구로 취급하지 않음

## 크기·오류

- JSON UTF-8만 지원. multipart·원격 이미지 URL은 현재 계약에서 제외
- recognize 본문 전체 4MiB, 디코딩 이미지 2MiB. JPEG·PNG·WebP만 허용하며 MIME와 매직 바이트 대조. 서버의 형식 서명 검사는 완전한 이미지 디코딩 검증과 다름
- 프론트는 긴 변 1280px 이하, JPEG 재인코딩 후 1MiB 이하로 전송 권장. 체크 화면 원본은 20MiB 이하, 디코딩 후 4천만 화소 이하. HEIC는 JPEG 변환 필요
- base64는 data URL 접두사·줄바꿈 없이 전송. evaluate·resolve-product 본문은 128KiB
- 본문 수신 5초, Gemini 호출 20초, 클라이언트 HTTP 요청 25초. 자동 유료 재시도 없음
- 400 INVALID_REQUEST, 403 ORIGIN_NOT_ALLOWED, 404 UNKNOWN_AIRLINE/NOT_FOUND, 405 METHOD_NOT_ALLOWED, 408 REQUEST_TIMEOUT, 409 AIRLINE_NOT_ENABLED, 413 PAYLOAD_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE, 429 RATE_LIMITED, 502 *_FAILED, 503 SERVICE_UNAVAILABLE, 504 UPSTREAM_TIMEOUT
- Netlify 플랫폼에서 함수 실행 전에 차단한 요청은 자체 오류 형식이 아닐 수 있음. 클라이언트는 비JSON 오류도 처리

## 변경 절차

계약 변경 → 버전·CHANGELOG 갱신 → fixture·문서·실제 핸들러 동기화 → contract:generate → npm run check. 프론트에 전달한 필드·enum을 백엔드 단독으로 변경하지 않는 원칙.
