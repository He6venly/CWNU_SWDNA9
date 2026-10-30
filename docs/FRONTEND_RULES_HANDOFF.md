# 프론트 추가 인계 — 규정 판정

최신 구현 추가: 사진 없는 빠른 확인·구조화된 결과·로컬 도감·한영 직원 모드. PR 공유 시 자동 검사에서 발견한 React 경고를 수정하고 npm run check 통과(기존 163개 테스트·린트·타입·빌드). 사용자 화면·모바일 전체 흐름은 아직 미검증.

### 빠른 확인·상세 결과·직원 모드

- `createManualItem(categoryId,id)`(contract/v2/manual.ts): 보조배터리·고데기·액체 빈 입력 생성. identification=manual, imageId 생략. 안전 상태·사양은 null에서 직접 입력·확인
- evaluate 요청에 `resultFormat:'detailed'`를 넣으면 각 결과의 `presentation`에 conditions(코드·한영 문구·적용 구분), requiredInfo, sources, 규정 검수일/기한, 승인·사용/충전 상태, staffSummaryEn 반환. 기존 reason·action 유지, 옵션 생략 시 이전 응답 유지
- 프론트는 reason 문자열을 분석해 조건을 만들지 않고 presentation을 표시. resultScenario:'battery-conditional' 목업으로 조건부 카드 구성 가능(실제 규정 판정 아님)
- 빠른 규정 확인은 `/rules`의 `ruleLimits`를 사용해 선택 항공사의 Wh·수량·액체 용량을 표시. 클라이언트 고정 숫자로 대체하지 않음
- CatalogCard.photoKeys는 직접 입력이면 빈 배열 가능. assessmentContext에 판정 당시 목록·전체 목록 여부 저장. 사진 인식 결과와 직접 입력을 혼동하지 않음
- `contract/v2/catalog-store.ts`: 사진 Blob과 카드의 IndexedDB 저장·목록·삭제·사진 조회. 서버 저장·계정 동기화 없음. 기존 별도 프론트 DB를 덮어쓰지 않는 독립 저장소이며 프론트 저장 모듈로 교체 가능
- apps/check/src의 ResultCard → Catalog → StaffCard가 연결 예시. 직원 모드에 저장 사진·모델·사양·기내/위탁·조건·출처·규정 기준일·영문 요약 표시, 인쇄/PDF와 기한 경과 안내 포함
- 직원 모드는 저장 당시의 참고 화면이며 현재 유효한 허가로 표시하지 않음. 과거 결과에 상세 정보가 없으면 재판정 안내

기존 contract 2.0.0 응답·1.0 API 유지. 선택 요청 필드와 GET /api/v2/rules를 추가한 호환 확장. 추가정보 없는 입력은 지원 항공사에서 NEEDS_INFO. 최신 contract 전체를 병합한 뒤 아래 입력 UI를 연결.

## 입력

```ts
import { emptyDetails } from './contract/v2/item-details.ts'

const details = emptyDetails('power-bank')
// 실제 제품 확인 후 사용자가 선택. null/false를 임의로 안전한 값으로 채우지 않기.
const item = { ...recognizedItem, confirmed: false, userEdited: false, details }
const request = {
  airlineId: 'korean-air', flightType: 'domestic', departureCountry: 'KR',
  inventoryComplete: false, // 여행자 1명의 전체 물품 목록인지 별도 선택
  items: [item],
}
```

- details의 type과 item.categoryId는 같아야 함. 형식·enum·null 기준은 item-details.ts가 단일 기준
- 추가정보는 사진에서 추측하지 않고 직접 입력·확인. details.confirmed와 item.confirmed를 최종 확인 때 갱신
- 분류 변경 시 details를 emptyDetails(newCategory)로 초기화. 필드·안전정보·수량·항공사·노선 변경 시 기존 판정 폐기
- mAh/V 수정 시 이전 calculated Wh 폐기. USB 출력 전압은 nominal로 처리하지 않기
- fields.ml은 남은 내용물이 아니라 용기의 표시 용량. count는 그 카드의 동일 조건 물품 수. 서로 다른 용량/안전 상태는 별도 카드
- 한 사람의 짐만 한 요청으로 전달. 중복 사진·도감 카드를 같은 실물로 중복 집계하지 않게 사용자가 확인
- details 누락은 400이 아니라 확인 필요. 분류와 details.type 불일치·잘못된 enum·범위는 400

## 결과·표시

- 지원 16개 항공사: 항공사별 검수 규정 알고리즘, meta.isDemoRules=false, result.isDemo=false, 개별 ruleVersion 제공
- 운영에서 인식은 Gemini, 제품 조회는 Tavily를 사용. 각 응답의 `meta` 플래그로 실제 연동 여부 확인
- createMockClient.evaluate는 기존 고정 NEEDS_INFO 유지. 실제 판정 검수는 로컬 API의 지원 항공사로 수행
- 합산 초과: verdict=PROHIBITED, reason의 현재 구성 불가 안내, action=CHECK_CONDITIONS. 모든 물품을 버리라는 뜻이 아니므로 action을 UI에서 재계산하지 않기
- 출력용 displayValue를 판정에 다시 사용하지 않기. 최신 판정이 반환한 derivedFields.wh를 표시
- await api.rules(airlineId)로 항공사별 출처·검수일·재검수 기한·scope.notice 표시. 검수기한 초과 시 항공사 비활성·evaluate 409, 입력 보존하고 재검수 필요 안내
- 규정 목업 rules()는 시연 메타데이터이며 current=false·ruleVersion=null. 실제 최신성 확인으로 표시하지 않기
- 선택 항공사 직접 운항편·한국 출발·1명 기준 명시. 공동운항·환승·목적지 세관/검역·수하물 규격/무게를 판정한 것처럼 표시하지 않기

도감은 추가된 선택 details와 ruleVersion·evaluatedAt을 보관. 예전 카드는 원본을 보존하고 최신 규정과 다르면 재판정 안내. 도감이 직원의 허가를 대체하지 않는 참고 화면이라는 문구 유지.

품목별 지원/미지원 범위·공식 근거·재검수 절차: docs/RULE_ENGINE.md. 내부 입력 화면: apps/check/src/DetailsEditor.tsx·ItemEditorV2.tsx.

## Gemini 연결 준비

- 운영·로컬 기본은 USE_DEMO_RECOGNITION=false, GEMINI_CALLS_ENABLED=true, 서버 GEMINI_API_KEY·GEMINI_MODEL 설정. 시연 모드는 개발·테스트에서만 명시적으로 true 사용
- 제품 조회는 모델명이 정확히 일치하고 검색 인용 출처가 있는 후보만 반환. apply-candidate.ts의 applyCandidate로 기존 값을 보존하고 빈 값만 채운 뒤 재확인
- createMockClient({lookupScenario:'candidate'})로 실제 호출 없이 후보 적용 UI 개발 가능. 가상 사양·출처임을 표시
- 실제 조회 응답에는 선택 searchSuggestions HTML이 추가될 수 있으므로 최신 계약으로 갱신한 뒤 실제 연결 활성화. LookupCandidates.tsx처럼 스크립트 없는 sandbox iframe에서 표시하고 직접 DOM 삽입 금지
- 인식은 Interactions 1회. 조회는 GenerateContent 검색 1회 후 인용이 있을 때만 Interactions 구조화 1회(최대 2회). 검색+JSON 강제 출력 호환 문제를 피하고 실제 검색 메타데이터의 URL을 서버에서 연결. 추가 비용은 조회에만 발생하며 자동 재시도 없음. 전체 조회 20초 제한, 사진 재전송 없음
- AI 출력 제약은 제공자에 구조만 전달하고 세부 길이·URL·범위는 서버 Zod로 검증. 배터리 입력·출력 전압을 공칭전압으로 사용하지 않음
- 2026-10-30: 실행 환경 gemini-2.5-flash에서 EB-P3400 제품 후보·검색 출처 반환, 합성 단색 이미지의 물품 없음 응답 200 확인. 실제 제품 사진 품질·모바일 전체 흐름·Netlify 배포는 미검증

공식 구현 기준: [Interactions](https://ai.google.dev/gemini-api/docs/interactions-overview), [구조화 출력](https://ai.google.dev/gemini-api/docs/structured-output), [검색 grounding](https://ai.google.dev/gemini-api/docs/google-search). Netlify에서는 같은 서버 환경변수를 Functions에 등록하고 재배포해야 하며 키에 VITE_ 접두사를 사용하지 않음.
