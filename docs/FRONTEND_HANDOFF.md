# 프론트 병렬 작업 인계 — 계약 1.0.0

> 기존 1.0.0 인계 기록. 새 사진 등록·필드 출처·노선 구분의 계약 2.0.0은 contract/v2와 /api/v2로 제공. 새 연동은 docs/FRONTEND_HANDOFF_V2.md 확인. 기존 프론트 이행 전 1.0 API·목업 유지.

최신 사진 입력 요구: 기존 사진을 보관함·파일에서 선택해 등록하는 방식이 기본. 카메라 권한·앱 내 촬영을 필수로 두지 않고, 파일 입력에서 capture 속성으로 카메라를 우선 유도하지 않는 기준. 전체 짐/개별 물품 사진을 선택하고 미리보기·필요한 크롭·품질 확인 후 분석 요청. 선택 자체로 자동 AI 호출하지 않음.

상태: 공용 계약·로컬 스텁·목업 준비. 실제 Gemini 호출·항공사 최신 규정·원격 배포는 미연결/미검증. 임시 서비스 제목은 여행 짐 반입 확인.

## 담당 경계

| 프론트 담당 | 백엔드 담당 |
| --- | --- |
| 사용자용 UI/UX·포토샵 티켓·모바일 촬영/업로드 | Netlify Functions·입출력 검증·공용 계약 |
| 사용자 정보 수정·제품 후보 선택·확인 표시 | 사진에서 물품·제품 라벨 인식, 제품 정보 검색 연결 |
| 기내/위탁 결과·출처·시연 상태 표시 | Gemini와 항공사 규정 대조·결과 안전 검증 |
| 사진·도감 카드 IndexedDB 저장/조회/삭제 | 도감 카드에 필요한 제품·결과·요약 구조 제공 |

프론트는 contract/를 사용하고 원본을 임의 변경하지 않는 방식. 백엔드 작업 파일은 netlify/와 apps/check/. 같은 저장소에 사용자 UI를 추가한다면 apps/web/ 등 별도 폴더에서 작업하고, 루트 package.json·Vite·Netlify 설정 변경은 협의 후 진행.

## 바로 시작

전체 저장소에서는 npm ci 후 npm run dev. 체크 화면과 API는 기본 http://127.0.0.1:5173. 별도 프론트 개발 서버는 5174 등 다른 포트 사용.

백엔드 없이 시작하려면 contract/ 폴더를 프론트 소스 안에 복사하고 Zod 4.6.7 이상 4.x를 설치. TypeScript는 resolveJsonModule, allowImportingTsExtensions 사용. Vite 기반 프로젝트에서 TS 소스로 가져오는 방식이며 별도 npm 배포 패키지는 아님.

```ts
import { createMockClient } from './contract/mock.ts'
import { createApiClient } from './contract/client.ts'
import type { ApiClient } from './contract/client.ts'
import { labels } from './contract/labels.ts'

// 디자인·동작 개발: 서버·키·외부 호출 없이 실행
const api: ApiClient = createMockClient({ scenario: 'needs-info', delayMs: 300 })

// 실제 로컬 API로 바꿀 때도 같은 메서드 사용
// const api: ApiClient = createApiClient({ baseUrl: 'http://127.0.0.1:5173' })
const { airlines } = await api.airlines()
const { categories } = await api.categories(airlines.find(a => a.enabled)!.id)
```

목업 시나리오: needs-info / cabin / checked / conditional / prohibited / unknown / product-found / empty / error. 시나리오는 개발 코드에서 선택하며 서버에 보내는 숨은 파라미터가 아님. 제품 입력값으로 결과를 계산하지 않음. product-found는 명시적으로 가상 제품·출처를 반환하는 디자인용 예시. empty는 인식 0건, error는 400 구조화 오류, delayMs는 로딩·취소 UI 확인용.

## 사용자 흐름과 화면 상태

| 순서 | 프론트 처리 | API |
| --- | --- | --- |
| 1 | 시연 상태·참고 안내 노출, 준비 중 항공사 선택 차단 | meta, airlines, categories |
| 2 | 촬영/선택 → 크기 제한·JPEG 재인코딩 → 전송 | recognize |
| 3 | 0건이면 재촬영·수동 입력 안내. 물품명·카테고리·제품 라벨 수정 | 응답 items 사용 |
| 4 | 모델명 확인 후 제품 정보 검색. 출처 있는 후보를 사용자에게 제시 | resolveProduct |
| 5 | 사용자가 선택한 후보 정보 반영, unreadFields 갱신, confirmed 표시 | 별도 API 없음 |
| 6 | 항공사와 현재 ItemInfo 목록으로 판정 요청 | evaluate |
| 7 | 기내·위탁 각각 결과·설명·권장 조치·미확인 필드 표시 | results를 itemId로 매칭 |
| 8 | 확인된 사진·물품·항공사·결과·출처·시각을 로컬 도감 저장 | CatalogCardSchema, 서버 저장 없음 |

recognize는 사진에서 읽은 값만 추출하고 제품 검색·판정을 수행하지 않음. resolve-product는 모델명 기준 검색 후보 반환. 검색된 용량을 사진에서 직접 읽은 값처럼 표시하지 않음. 후보의 출처와 사진의 라벨 불일치는 사용자에게 확인 요청. 현재 실제 API는 인식 고정 4개·검색 후보 없음·판정 NEEDS_INFO 고정 응답임.

필드·API·오류 세부 기준은 contract/README.md와 openapi.yaml 참고. 계약 상태 확인은 /api/meta.capabilities 사용. isDemoRecognition 또는 isDemoRules가 true이면 시연 배너 표시. evaluation=stub이면 별도 고정 응답 안내도 표시.

## 도감 카드·직원 참고 화면

- CatalogCardSchema: id, photoKey, item, result, airline, productSources, savedAt, evaluatedAt, meta
- photoKey는 IndexedDB Blob 참조용 키. 이미지 base64를 localStorage에 누적하지 않는 방식 권장
- result.itemId와 item.id 일치, airline.id와 실제 판정 요청의 airlineId 일치 확인
- 사진은 전체 촬영본을 재사용해도 되며 bbox가 있을 때만 별도 잘라내기. bbox가 없는데 개별 물품 사진으로 가장하지 않음
- 제품 정보·기내/위탁 결과·설명·요약·항공사·판정 시각·시연 표시를 한 화면에서 읽을 수 있게 구성
- 물품 확인 전 저장 차단. 수정 후에는 기존 결과를 폐기하고 재판정. 카드는 저장 당시 참고 정보이며 최신 규정 확인을 대신하지 않음
- staffSummary는 참고 문구. 티켓처럼 꾸미더라도 공식 허가증으로 보이는 제목·표현은 사용하지 않음

## 반응성·오류 처리

- 긴 변 1280px, 전송 전 1MiB 이하 목표. JPEG/PNG/WebP만 입력, HEIC는 변환 안내
- 브라우저 이미지 변환은 실제 기기에서 메모리·지연 확인 필요. 체크 화면의 구현은 기능 확인용이며 전용 이미지 처리 라이브러리는 없음
- 요청 중 로딩과 취소 제공, 중복 전송 방지. 새 사진·항공사·정보 변경 시 이전 요청 취소 및 오래된 응답 폐기
- 사용자 숫자 입력은 Number 변환 후 빈 값은 null. unreadFields는 null 필드와 정확히 일치
- 413이면 이미지 축소, NEEDS_INFO면 해당 정보 입력, NOT_FOUND면 직접 제품 라벨 입력, 429/시간 초과면 안내 후 사용자가 재시도. 자동 유료 반복 요청 금지
- 수치나 출처가 없으면 임의 보완하지 않음. 새 제품 값이 들어와도 사용자 확인 전 자동 저장하지 않음
- 배지에는 색과 텍스트 병행. 360px 화면, 큰 글자, 긴 모델명·설명, 키보드·포커스 상태 확인
- 제품명·API 문자열은 텍스트로 렌더링. dangerouslySetInnerHTML 금지. 출처는 https URL만 표시하고 외부 링크에 noopener/noreferrer 적용

## CORS·키

백엔드 .env.local 또는 Netlify Functions 범위 환경변수 ALLOWED_ORIGINS에 프론트의 정확한 Origin 등록. 예: http://localhost:5174,http://127.0.0.1:5174. URL 경로·끝 슬래시·와일드카드 제외. 쿠키·인증 자격증명 전송 없음.

Gemini 키는 서버 전용 GEMINI_API_KEY. 프론트·VITE_ 환경변수·사진 로그·도감에 키를 넣지 않음. CORS는 브라우저 출처 제어이며 인증·요금 방어 수단이 아님.

## Gemini 연결 준비 상태

- netlify/functions/_lib/providers/gemini.ts에 인식·제품 검색·규정 대조 어댑터 제공. SDK 추가 없이 서버 fetch 사용
- 제품 정보 검색은 Google Search grounding의 인용 URL과 후보 출처를 대조. 모델명 미확인이면 유료 검색 호출하지 않음
- 판정에는 백엔드가 검증·관리하는 RuleEvidence와 기내/위탁별 필수 정보 기준 필요. 사용자 입력이나 Gemini의 기억을 규정 출처로 사용하지 않음
- null 처리·출처·ID·금지 표현·조치 일관성·추가 필드 누락은 서버에서 검사. 실제 데이터 정확성을 보증하는 자동 검증은 아님
- store:false로 상태 저장 제외 요청. Google 자체 데이터 처리 정책까지 저장하지 않음을 보장하는 의미는 아님
- 실제 모델·키·공식 항공사 규정·요청/비용 제한 확인 뒤 B3에서 라우터 연결. 현재 환경변수만 넣어도 실제 호출은 시작되지 않음
- 최신 모델명은 임의 기본값으로 지정하지 않음. GEMINI_MODEL로 서버 설정. 실제 API 호환성·사진·검색 출처는 실연결 시 추가 검증 필요

## 변경·검증·미완료

- 변경 요청은 계약 담당에게 전달. version·schema·OpenAPI·fixture·호출 코드 함께 변경
- npm run contract:generate로 명세 재생성, npm run check로 lint·test·타입 검사·빌드
- 실제 규정 판정, 실사진 Gemini 검증, 배포 URL, 프론트 IndexedDB와 완성 UI는 이번 인계의 완료 항목이 아님
- 검증 상세는 docs/VALIDATION.md. 실제 배포 URL이 없으므로 현재 프론트는 목업 또는 로컬 스텁으로 개발

공식 근거: [Netlify Functions](https://docs.netlify.com/build/functions/api/), [Gemini 이미지 인식](https://ai.google.dev/gemini-api/docs/image-understanding), [구조화 출력](https://ai.google.dev/gemini-api/docs/structured-output), [검색 grounding](https://ai.google.dev/gemini-api/docs/google-search), [Interactions와 저장 옵션](https://ai.google.dev/gemini-api/docs/interactions-overview).
