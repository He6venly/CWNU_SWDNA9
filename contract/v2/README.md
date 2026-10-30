# 계약 2.0.0 — 전체·개별 사진 등록

이번 범위는 공용 계약·클라이언트·목업·시연 API·체크 화면. 실제 Gemini·제품 검색·규정 엔진은 미연결. 1.0.0의 /api/* 및 기존 클라이언트는 유지.

## 시작

```ts
import { createMockClient } from './contract/v2/mock.ts'
import { createApiClient } from './contract/v2/client.ts'
import type { ApiClient } from './contract/v2/client.ts'

const api: ApiClient = createMockClient({ scenario: 'standard', delayMs: 200 })
// 로컬 API 연결 시 인터페이스를 유지한 채 교체
// const api: ApiClient = createApiClient({ baseUrl: 'http://127.0.0.1:5173' })
const metadata = await api.meta()
const airlines = await api.airlines()
```

Vite·TypeScript 소스로 사용하는 방식. Zod 4.x 필요, allowImportingTsExtensions·resolveJsonModule 설정. 상위 공용 타입·오류를 재사용하므로 복사 배포 시 contract/v2만이 아니라 contract/ 전체를 포함.

## 버전·경로

| 역할 | 1.0 유지 | 2.0 |
| --- | --- | --- |
| 모듈 | contract/client.ts, mock.ts | contract/v2/client.ts, mock.ts |
| API | /api/* | /api/v2/* |
| 인식 입력 | airlineId + image | captureMode + images, 개별만 mode·targetItemId |
| 인식 결과 | items | items + 이미지별 품질·재등록·추정 안내 |
| 제품 조회 | resolveProduct, /resolve-product | lookup, /lookup |
| 판정 입력 | airlineId + items | airlineId + flightType + departureCountry + items |
| 판정 결과 | results + meta | airlineId + flightType + departureCountry + ruleVersion + results + meta |
| 저장 형식 | 단일 photoKey | photoKeys 배열 + flightType + 출처·식별 방식 |

- 경로별 health·meta·airlines·categories·recognize·lookup·evaluate 제공. 2.0에는 resolve-product 별칭 없음
- 모든 성공 응답 meta: contractVersion=2.0.0, isDemoRecognition, isDemoRules, isDemoLookup
- 오류는 기존 {error:{code,message}} 유지. OPTIONS 정상은 본문 없는 204
- /api/v2/meta.capabilities로 demo/stub/unavailable 구분. 실제 미연결인데 규정 판정이 완료된 것처럼 표시하지 않음
- 계약과 표준 JSON Schema로 표현하기 어려운 출처·ID·모드 제약은 schemas.ts의 의미 검증 함수가 함께 담당. OpenAPI 설명에도 해당 조건 명시

## 사진 등록 요청

기본 흐름은 이미 찍어 둔 사진 선택 → 미리보기·필요한 크롭 → 분석 요청. 선택만으로 자동 AI 호출하거나 카메라 권한을 요구하지 않음.

```ts
await api.recognize({
  captureMode: 'overview',
  images: [{ id: 'photo-1', kind: 'overview', mimeType: 'image/jpeg', base64: photoBase64 }],
})
await api.recognize({
  captureMode: 'detail', mode: 'label', targetItemId: 'existing-item-1',
  images: [{ id: 'photo-2', kind: 'label', cropped: true, mimeType: 'image/jpeg', base64: photoBase64 }],
})
```

- photoBase64는 프론트가 전처리한 실제 JPEG의 base64 문자열 변수. data URL 접두사는 제외. 실제 id는 영문·숫자·하이픈·밑줄 사용
- overview: overview 이미지 정확히 1장, mode·targetItemId 없음. 다중 물품은 정상이며 여러 물품이 있다는 이유로 재등록 요청하지 않음
- detail: 같은 물품의 label/closeup 사진 1~3장. mode=label이면 label 사진 최소 1장, mode=estimate이면 closeup 사진 최소 1장
- 이미지 ID는 한 요청 안에서 고유. targetItemId가 있으면 반환 물품 ID도 해당 ID. 서버에 저장된 물품을 조회/수정하는 API가 아닌 프론트 연결용 참조
- 인식 응답은 두 경우 모두 items 배열. 개별은 0~1개, 개별 사진에 서로 다른 물품이 있으면 multipleItemsDetected=true, items=[]
- 인식 0건은 HTTP 200, items=[] + NO_ITEM_DETECTED 안내. 오류와 정상적인 무인식 상태 구분
- quality는 imageId로 연결. source=demo 및 usable=null은 품질을 실제 측정하지 않았다는 의미. 시나리오의 blur 등도 실제 이미지 분석 결과가 아님
- bbox는 imageId가 가리키는 전송 이미지의 정규화 좌표 [x,y,width,height]. 크롭 전 원본 좌표로 오인하지 않음. 원본 변환 관계는 프론트에서 별도 보관
- targetItemId로 보완하더라도 기존 물품과 같은 제품인지 사용자 확인. 새 응답을 자동 병합해 모델·수치가 섞이지 않게 처리

## 필드·출처

- fields는 brand, modelName, wh, mah, volts, ml, count 7개 키를 항상 포함. 모르면 null
- unreadFields는 null인 키와 정확히 일치하며 중복 없음. 0·빈 문자열로 미확인 상태를 대체하지 않음
- 값이 있는 필드에는 fieldSources가 반드시 있고, null 필드에는 출처가 없어야 함
- source: label / user / calculated / lookup, confirmed는 해당 필드를 사용자가 확인했는지 여부
- label은 imageId, lookup은 https sourceUrl이 필수. user는 confirmed=true. 전체 ItemInfo.confirmed는 물품 전체 확인 상태로 별도 유지
- volts의 출처에 voltageType: nominal / output / unknown. USB 출력 전압을 공칭 전압으로 사용하지 않음
- calculated는 wh에서만 허용. basis=mah*volts/1000, 같은 물품의 mah·volts와 공칭 전압이 필요. 반올림 전 값이 입력과 일치해야 함
- 이 출처 정보는 클라이언트가 전달하는 이력 메타데이터이며, 변조 방지 인증이나 공식 증명서가 아님
- identification: label_read / ai_estimated. ai_estimated에는 눈에 보이는 근거와 후보 1~3개를 포함. 브랜드·모델·수치를 외형으로 추정하지 않음
- 값 수정 시 source=user로 갱신하고 물품 전체 confirmed를 해제. 미확인 조회값을 자동 승인하지 않음

## 항공사·노선·판정

- 첫 실제 연동 대상은 대한항공(korean-air). 현재는 규정 연동 전이므로 enabled=false. 시연 항공사만 enabled=true
- 지원 범위는 한국 국내선·한국 출발 국제선. flightType은 domestic / international, departureCountry는 KR 고정이며 categories·evaluate에 필수. 해외 출발 요청은 현재 400. categories 클라이언트 메서드는 KR을 자동 전달
- 인식에는 항공사·노선을 보내지 않아 변경 시 재인식 불필요. 제품 자체 인식과 적용 규정 범위를 분리
- categories의 requiredFields는 cabin/checked 각각 유지. general-items만 allowed_with_confirm 정책 예시이며 나머지는 never_definitive
- 현재 evaluate는 모든 결과 NEEDS_INFO, derivedFields={}, ruleVersion=null. Wh 계산·정식 규정 판정은 아직 수행하지 않음
- 향후 derivedFields.wh의 value는 판정용 반올림 전 값, displayValue는 표시용. basis·source를 함께 제공
- 판정 응답의 airlineId·flightType·itemId 일치를 클라이언트도 검사. 정보·노선 변경 시 이전 결과와 진행 중 응답 폐기
- 실제 규정 최신성·추정 제한·조회값 확인·일관된 알고리즘은 다음 규정 엔진 단계에서 구현

## 클라이언트·목업

- 메서드: health(signal?), meta(signal?), airlines(signal?), categories(airlineId,flightType,signal?), recognize(body,signal?), lookup(body,signal?), evaluate(body,signal?)
- baseUrl은 호스트까지만 지정. 클라이언트가 /api/v2를 추가. /api/v2를 baseUrl에 중복 입력하지 않음
- 요청 구조·의미와 응답 ID·이미지 연결을 검증. 로컬 입력 오류 INVALID_REQUEST, 잘못된 응답 INVALID_RESPONSE. 네트워크 오류와 사용자 취소는 별도 처리
- mock 시나리오: standard / empty / multiple / no-label / blur / risk-estimate / low-confidence. 선택한 모드에 의미 있는 시나리오를 사용 (예: no-label은 detail+label)
- 시나리오는 개발용 mock 옵션. 실제 API 요청에 scenario·숨은 파일명 조건을 추가하지 않음
- fixtures/requests.json은 형식 예시이며 base64는 이미지 서명만 담은 자리표시자. 실제 브라우저 업로드·실제 Gemini에 사용하지 않음
- fixtures/responses.json은 인식 9개 시나리오의 요청/응답 산출물. 실제 규정 정답·품질 측정값이 아닌 시연용 예시이며 생성 스크립트로 갱신
- API 실제 시연 응답은 이미지 내용과 무관한 고정 값. 테스트의 mAh·V·종류·추정 후보는 실제 제품 정보가 아님

## 제한·보안

- 인식 요청 전체 JSON UTF-8 4MiB, 개별 디코딩 이미지 2MiB, 물품 목록 30개. 표준 base64만 지원
- JPEG·PNG·WebP. 클라이언트 1280px·1MiB 목표는 현재 공통 변환 기준이며 라벨 판독 품질·비용 최적화의 최종 검증값 아님
- 사진·base64·개인정보 서버 저장/로그 없음. 요청 뷰어에서 사진 데이터 생략. 선택만으로 네트워크 호출 없음
- 기존 CORS 허용 목록·본문 크기·수신 제한·공통 오류 적용. 클라이언트의 메타데이터를 서버 보안 검증 대신 사용하지 않음
- USE_DEMO_RECOGNITION=false이면 실제 공급자로 조용히 전환하지 않고 인식·조회 503. 외부 Gemini 호출·비용은 이번 단계에서 없음
- 실제 규정 연결 전까지 조건부 가능/가능을 실제 판정으로 보여주지 않음. 직원 참고 안내와 시연 배너 유지

## 프론트 전환

1. 기존 1.0 호출은 유지한 채 import만 v2로 전환하는 별도 클라이언트 모듈 작성
2. 사진·필드 출처·국내/국제 선택 UI를 2.0 DTO에 연결
3. 1.0 데이터의 제품 출처를 임의 생성하지 않음. 기존 도감은 원본 보존·읽기 전용 또는 사용자 재확인 후 2.0으로 별도 저장
4. API 스텁·mock·fixture·체크 화면을 대조하고 CORS에 실제 프론트 Origin 등록
5. 프론트 전환 검증 전 1.0 경로 제거 금지

OpenAPI는 npm run contract:generate로 두 버전 동시 생성. 신규 의존성 없음. npm run check에서 기존 버전 회귀와 2.0 검증을 함께 실행.
