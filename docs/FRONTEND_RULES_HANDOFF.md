# 프론트 추가 인계 — 규정 판정

기존 contract 2.0.0 응답·1.0 API 유지. 선택 요청 필드와 GET /api/v2/rules를 추가한 호환 확장. 기존 클라이언트가 보내는 추가정보 없는 입력은 대한항공에서 NEEDS_INFO. 최신 contract 전체를 병합한 뒤 아래 입력 UI를 연결.

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

- 대한항공: 실제 검수 규정 알고리즘, meta.isDemoRules=false, result.isDemo=false, ruleVersion 제공
- 인식·제품 조회는 여전히 시연. isDemoRules=false를 전체 AI 연동 완료로 해석하지 않기
- 시연 항공사와 createMockClient.evaluate는 기존 고정 NEEDS_INFO 유지. 실제 판정 검수는 로컬 API의 대한항공으로 수행
- 합산 초과: verdict=PROHIBITED, reason의 현재 구성 불가 안내, action=CHECK_CONDITIONS. 모든 물품을 버리라는 뜻이 아니므로 action을 UI에서 재계산하지 않기
- 출력용 displayValue를 판정에 다시 사용하지 않기. 최신 판정이 반환한 derivedFields.wh를 표시
- await api.rules('korean-air')로 출처·검수일·재검수 기한·scope.notice 표시. 검수기한 초과 시 항공사 비활성·evaluate 409, 입력 보존하고 재검수 필요 안내
- 규정 목업 rules()는 시연 메타데이터이며 current=false·ruleVersion=null. 실제 최신성 확인으로 표시하지 않기
- 대한항공 직접 운항편·한국 출발·1명 기준 명시. 공동운항·환승·목적지 세관/검역·수하물 규격/무게를 판정한 것처럼 표시하지 않기

도감은 추가된 선택 details와 ruleVersion·evaluatedAt을 보관. 예전 카드는 원본을 보존하고 최신 규정과 다르면 재판정 안내. 도감이 직원의 허가를 대체하지 않는 참고 화면이라는 문구 유지.

품목별 지원/미지원 범위·공식 근거·재검수 절차: docs/RULE_ENGINE.md. 내부 입력 화면: apps/check/src/DetailsEditor.tsx·ItemEditorV2.tsx.

## Gemini 연결 준비

- 연결 코드는 구현했으며 실제 호출은 잠금. .env.example의 GEMINI_CALLS_ENABLED=false 유지. 키만 추가해도 호출되지 않음
- 추후 수동 테스트 때만 USE_DEMO_RECOGNITION=false, GEMINI_CALLS_ENABLED=true, 서버 GEMINI_API_KEY·GEMINI_MODEL 설정. 검색 모델은 GEMINI_LOOKUP_MODEL로 분리 가능
- 제품 조회는 모델명이 정확히 일치하고 검색 인용 출처가 있는 후보만 반환. apply-candidate.ts의 applyCandidate로 기존 값을 보존하고 빈 값만 채운 뒤 재확인
- createMockClient({lookupScenario:'candidate'})로 실제 호출 없이 후보 적용 UI 개발 가능. 가상 사양·출처임을 표시
- 실제 조회 응답에는 선택 searchSuggestions HTML이 추가될 수 있으므로 최신 계약으로 갱신한 뒤 실제 연결 활성화. LookupCandidates.tsx처럼 스크립트 없는 sandbox iframe에서 표시하고 직접 DOM 삽입 금지
- 인식은 검색하지 않고, 제품 검색은 사진을 다시 전송하지 않음. 20초 제한·자동 재시도 없음. 실제 활성화·공개 전에 모델 지원·제공자 비용 제한·프론트 표시를 확인해야 함

공식 구현 기준: [Interactions](https://ai.google.dev/gemini-api/docs/interactions-overview), [구조화 출력](https://ai.google.dev/gemini-api/docs/structured-output), [검색 grounding](https://ai.google.dev/gemini-api/docs/google-search). 실호출 성공 여부는 아직 검증하지 않음.
