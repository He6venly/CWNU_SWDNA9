# 프론트 전환 안내 — 계약 2.0.0

최신 추가: 대한항공 규정 엔진·선택 입력 details/inventoryComplete·출처 조회 구현. 먼저 docs/FRONTEND_RULES_HANDOFF.md 확인. 아래는 최초 시연 계약 이력이며 항공사 비활성·규정 미연결 설명은 최신 상태와 다름. 실제 Gemini·제품 검색은 미연결. 기존 1.0 프론트와 API 유지.

## 작업 경계

- 프론트: 사용자 화면, 기존 사진 선택·미리보기·크롭, 물품 확인·수정, 제품 후보 선택, 사진·도감 IndexedDB 저장
- 백엔드: contract/v2, /api/v2, API 보안·Provider·규정 엔진, 내부 체크 화면
- 기존 프론트 변경 보존. netlify/, apps/check/, 공용 contract를 프론트에서 임의 변경하지 않는 방식

## Git으로 받기

원본 저장소는 He6venly/CWNU_SWDNA9. 프론트가 Fork에서 작업한다면 upstream이 원본 저장소인지 먼저 확인하고 다음처럼 받는 방식.

```sh
git remote -v
# upstream이 없을 때만 등록
# git remote add upstream https://github.com/He6venly/CWNU_SWDNA9.git
git fetch upstream codex/backend
# 프론트 브랜치에서 기존 작업을 먼저 커밋한 뒤 병합
git merge upstream/codex/backend
```

사용자 UI 파일을 덮어쓰거나 reset --hard로 맞추지 않음. 충돌이 있으면 프론트 작업을 보존하고 계약 변경은 백엔드와 대조. main은 아직 이전 상태이므로 이 단계에서는 main만 pull해서 새 계약을 받았다고 판단하지 않음.

## 목업부터 연결

```ts
import { createMockClient } from './contract/v2/mock.ts'
import { createApiClient } from './contract/v2/client.ts'
import type { ApiClient } from './contract/v2/client.ts'

const api: ApiClient = createMockClient({ scenario: 'standard', delayMs: 300 })
// 실제 로컬 서버로 바꿀 때:
// const api: ApiClient = createApiClient({ baseUrl: 'http://127.0.0.1:5173' })

const { airlines } = await api.airlines()
const categories = await api.categories('demo-airline', 'domestic')
```

전체 contract/ 폴더와 Zod 4.x를 사용. v2만 복사하면 상위 공용 타입·오류 모듈을 찾을 수 없음. 실제 API 경로는 클라이언트가 /api/v2를 추가하므로 baseUrl에는 호스트만 지정.

## 꼭 반영할 변화

| 화면·기능 | 연동 기준 |
| --- | --- |
| 사진 등록 | 이미 찍어 둔 사진 선택이 기본. 카메라 권한·촬영 강제 없음, 사진 선택만으로 AI 호출 없음 |
| 전체 짐 사진 | captureMode=overview, kind=overview 사진 정확히 1장, 물품 다건 정상 |
| 개별 물품 사진 | captureMode=detail, mode=label/estimate, 같은 물품 사진 1~3장 |
| 라벨/추정 | label이면 label 사진 필수, estimate이면 closeup 필수. 라벨 없음과 불명확 수치는 재등록·직접 입력 안내 |
| 기존 물품 보완 | targetItemId로 연결. 단건 응답의 물품 ID가 해당 ID. 같은 제품인지 사용자 확인 후 반영 |
| 인식 결과 | 항상 items 배열. 개별은 0~1개. 무인식은 200 + items:[] + 안내 코드 |
| 사진 품질 | imageQuality.source=demo, usable=null은 실제 품질 측정 아님. 시나리오의 blur 역시 고정 예시 |
| 필드 | brand 포함 7개 키 항상 포함, 모르면 null. unreadFields와 null 키 일치 |
| 출처 | label/user/calculated/lookup. 값이 있으면 출처 필수, label은 imageId, lookup은 sourceUrl 필요 |
| 사용자 수정 | 출처 user, 해당 필드 confirmed=true. 물품 전체 confirmed는 해제하고 최종 사용자 확인 별도로 받기 |
| 전압 | volts 출처의 voltageType은 nominal/output/unknown. USB 출력 전압으로 Wh를 계산하지 않음 |
| 항공사 | 대한항공은 첫 실연동 대상이지만 현재 준비 중으로 선택 비활성. 시연 항공사로 흐름 개발 |
| 노선 | domestic=한국 국내선, international=한국 출발 국제선. departureCountry=KR 고정 |
| 판정 요청 | {airlineId,flightType,departureCountry:'KR',items}. 현재 고정 NEEDS_INFO, ruleVersion=null, derivedFields={} |
| 제품 조회 | 새 메서드는 lookup. {itemId,categoryId,modelName,brand}. 현재 빈 후보, isDemoLookup=true |
| 도감 저장 | v2 CatalogCardSchema, photoKeys 배열·노선·출발국·출처·판정 시각·규정 버전 보관 |

물품·노선 변경 후 이전 판정 폐기. 항공사·노선 변경만으로 사진을 다시 인식하지 않음. 결과는 itemId로 매칭하고 항공사·노선·출발국이 요청과 일치하는지 확인. 클라이언트도 이 연결을 검사.

기존 1.0 도감은 원본 보존. 이전 필드의 출처를 임의로 label/user로 만들어 2.0으로 승격하지 않음. 읽기 전용 표시 또는 사용자 재확인 후 새 카드 저장.

## 사진 크기·반응성

- JPEG/PNG/WebP. 인식 본문 전체 UTF-8 4MiB, 디코딩 이미지별 2MiB. 현재 체크 화면은 긴 변 1280px·약 1MiB 목표로 변환
- 3장 × 1MiB도 base64 팽창과 JSON 때문에 전체 제한을 넘을 수 있음. 전체 전송 예산을 나눠 압축하고, 최종 JSON 바이트를 검사
- 2.0 클라이언트가 전송 전에 전체 크기를 검사해 PAYLOAD_TOO_LARGE 반환. 데이터가 큰 입력을 자동 재시도하지 않음
- 연속 선택·취소·모드 변경 시 진행 중 변환·요청 취소, 오래된 응답 폐기, Blob URL 해제
- 무거운 브라우저 OCR·자동 촬영·매 프레임 AI 호출은 추가하지 않음. 고해상도 실제 기기 성능·라벨 가독성 검증은 별도 필요
- bbox는 전송된 imageId 이미지 기준 정규화 좌표. 크롭 전 원본과의 관계는 프론트가 보관

## 목업·검증

- 시나리오: standard/empty/multiple/no-label/blur/risk-estimate/low-confidence
- no-label은 detail+label, risk-estimate·low-confidence는 detail+estimate에서 확인
- fixtures/requests.json·responses.json에 9개 인식 요청/응답 예시. 서명만 담은 base64 예시는 실제 사진이 아님
- npm run dev: 내부 체크 화면에서 2.0/기존 1.0 전환. 사용자용 프론트 실행 경로와 구분
- npm run check: 기존 회귀·새 계약·HTTP·의미 검증·빌드. API 버전 전환 시 기존 검증도 유지
- 브라우저 파일 등록 검수는 내부 브라우저 네트워크 중단으로 완료하지 못함. 새 화면의 전체·개별 사진·모바일·취소 흐름은 실제 환경에서 추가 검증 필요

표시 문구는 contract/v2/labels.ts 또는 /api/v2/meta.labels 사용. demo/stub 표시·참고 안내 유지. 실제 규정·제품 정보·보안검색 결과를 확인했다고 표시하지 않음. API 키는 백엔드에만 보관하고 프론트 VITE_ 변수에 넣지 않음.

정식 상세 기준: contract/v2/README.md, schemas.ts, openapi.yaml, CHANGELOG.md.
