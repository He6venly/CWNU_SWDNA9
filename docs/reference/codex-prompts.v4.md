# Codex 프롬프트 세트 v4 (백엔드 + 시연 체크 화면, 물품 단위 근접 촬영)

사용법: 저장소 루트에 `implementation-plan.md`와 `AGENTS.md`를 두고 Phase를 순서대로 하나씩 실행하세요. 각 Phase가 끝나면 결과를 확인하고 넘어갑니다. 사용자용 프론트(디자인)는 이 저장소의 범위가 아닙니다.

---

## 0. AGENTS.md (먼저 저장소 루트에 넣기)

```md
# 작업 규칙

- 기준 문서는 `implementation-plan.md`. 작업 전 읽고, 다르게 구현해야 하면 이유를 먼저 보고한다.
- 범위는 **백엔드 API, contract, 시연 체크 화면(apps/check)** 뿐이다. 사용자용 프론트/디자인 UI는 만들지 않는다. 체크 화면은 스타일을 꾸미지 않는다.
- Phase 단위로만 작업한다. 예약, 일정 추천, 긴급 신고, 로그인 등은 추가하지 않는다.
- **계약 우선**: 엔드포인트를 바꾸기 전에 `contract/`(types, schemas, openapi.yaml, labels, fixtures)를 먼저 수정하고 버전과 변경 내역을 기록한다.
- 인식(AI)과 판정(규정)을 분리한다. 판정 엔진은 순수 함수로 두고 테스트를 함께 작성한다.
- 인식 요청 1회 = 물품 1개(근접 사진 1~3장). 여러 물품이 보이면 고르지 말고 `multipleItemsDetected`로 알린다.
- 촬영 모드는 `label`(가이드 프레임으로 제품 정보 촬영)과 `estimate`(제품 정보가 없거나 읽기 어려운 물품의 근접샷)가 있다. 추정 모드 결과는 `ai_estimated`로 표시하고 사용자 확인 전에는 확정하지 않는다.
- **외형·크기로 Wh/mAh/전압/ml 같은 수치를 추정하지 않는다.** 사진에 인쇄된 글자가 읽힐 때만 채운다. 브랜드·모델명을 지어내지 않는다.
- 규정의 `estimatePolicy`가 `never_definitive`(기본값)인 카테고리는 AI 추정만으로 "가능"을 확정하지 않는다.
- 제품 정보(모델명, mAh, 전압, Wh, ml)를 읽지 못하면 만들어내지 않는다. `null` + `unreadFields`로 반환한다. **전압이 없으면 임의 전압을 가정하지 않는다.**
- 모든 필드에 출처(`label`/`user`/`calculated`/`lookup`)를 기록한다. 조회값은 사용자 확인 전 확정값으로 쓰지 않는다.
- 실제 AI·최신 항공사 규정이 없는 부분은 응답 `meta.isDemo*`와 데이터 `isDemo: true`로 명시한다. 규정 수치를 기억·추측으로 사실처럼 쓰지 않는다.
- API가 만드는 문구(reason, staffSummary, 결과·조치 라벨)에 "통과", "허가", "문제없음", "보장" 같은 단정·보장 표현을 쓰지 않는다. 면책 안내문(예: "…보장하지 않으며…")은 부정문 형태만 예외 목록으로 허용하고, 금지어 테스트를 유지한다.
- 서버는 사진을 저장하지 않고, 로그에 이미지·개인정보를 남기지 않는다.
- API 키·시크릿은 코드·번들·커밋에 넣지 않는다 (Netlify 환경변수, `VITE_` 접두사 금지).
- Netlify Functions와 Gemini API 사용법·한도는 작성 전에 현재 공식 문서를 확인하고, 확인한 내용을 보고한다.
- 새 의존성은 최소화하고 이유를 요약에 적는다.
- 작업 끝에 보고: 변경 파일, build/test 결과, DoD 충족 여부, 남은 이슈.
```

---

## Phase B0. 세팅 + 배포

```
`implementation-plan.md`의 1~4장, 5.9, B0를 읽고 B0만 수행해줘.

- 4장 저장소 구조대로 폴더 생성 (contract/, netlify/functions/, data/rules/, apps/check/, test/)
- TypeScript, Vitest, zod 설정. apps/check는 Vite + React + TypeScript로 초기화만(내용은 B1)
- Netlify Functions는 모던 방식(`export default async (req: Request) => Response` + `export const config = { path: ... }`)으로 작성. 공식 문서를 확인하고 필요하면 조정한 뒤 이유를 알려줘.
- netlify.toml: 빌드 명령, publish(apps/check 빌드 결과), functions 디렉토리, `/api/*` 라우팅
- `GET /api/health`: `{ ok: true, time }`
- `_lib/cors.ts`(ALLOWED_ORIGINS 기반), `_lib/errors.ts`(`{error:{code,message}}`, 5.9의 에러 코드 정의)
- README: Netlify 연결, 환경변수 목록(ALLOWED_ORIGINS, USE_DEMO_RECOGNITION, FALLBACK_TO_DEMO, GEMINI_API_KEY, GEMINI_MODEL)

DoD: build/test 통과, 로컬 실행 방법과 /api/health 확인 방법을 알려줘.
```

---

## Phase B1. 계약 + 스텁 API + 체크 화면 골격

```
`implementation-plan.md`의 2장, 5장 전체(5.1~5.8), 6장, B1을 읽고 B1만 수행해줘. 목표는 프론트 팀이 스텁과 픽스처만으로 물품 단위 흐름을 목업 개발할 수 있게 하는 것이다.

1. contract/ 작성
   - types.ts, schemas.ts(zod: 모든 요청/응답), openapi.yaml, contractVersion `1.0.0`
   - 5.4의 타입 그대로: Fields, FieldSource, DetectedItem(fieldSources, identification, estimate 포함), ItemInfo, ItemResult(derivedFields 포함), ImageQuality
   - 5.1의 recognize 요청(mode, kind, cropped)과 응답(imageQuality, suggestRetake, suggestEstimateMode)을 스키마와 openapi에 반영
   - lookup 엔드포인트(5.2)도 계약에 포함. 이 Phase에서는 항상 빈 후보 + meta.isDemoLookup=true 반환
   - labels.ts: 결과 라벨(가능/조건부 가능/불가/제품 정보 확인 필요), 조치 라벨(기내에 넣기/위탁하기/조건 확인하기/가져가지 않기), 출처 라벨(라벨 판독/직접 입력/계산값/조회), 시연 배너 문구("시연용 화면입니다. 실제 AI 인식·항공사 최신 규정과 연결되어 있지 않습니다."), 참고용 안내 문구("이 화면은 물품 정보를 보여주는 참고용입니다. 공항 보안검색 통과나 반입 허가를 보장하지 않으며, 최종 판단은 항공사와 보안검색 직원의 기준을 따릅니다."), 촬영 안내 문구(라벨이 보이도록 가까이 촬영)
   - fixtures/: 6장의 필수 시나리오 ①~⑮에 해당하는 요청·응답 JSON
2. 엔드포인트: GET /api/meta, /api/airlines(활성 1개 + 준비 중 1~2개), /api/categories?airlineId=, POST /api/recognize(Demo Provider: 요청 이미지와 무관하게 픽스처 응답, **물품 1개** 반환, isDemo true, mode가 estimate면 `ai_estimated` 픽스처, 라벨 모드는 선명/라벨 없음/흐림 픽스처를 선택 가능하게), POST /api/lookup(스텁), POST /api/evaluate(고정 응답 스텁, 입력/출력 스키마 검증)
3. recognize 요청 검증: mode(label|estimate) 필수, images 1~3장, 요청 전체 4MB 초과 시 PAYLOAD_TOO_LARGE, kind는 label|closeup, 라벨 모드는 label 이미지 1장 이상 필수
4. apps/check 골격: 상태 패널(health/meta, 시연 플래그, 무료 키 데이터 고지 문구 자리), 물품 담기(이미지 1~3장 업로드, 종류 선택, 긴 변 1280px 리사이즈 후 호출), 요청/응답 JSON 뷰어. 스타일은 기본 수준.
5. 계약 테스트: 모든 픽스처가 zod 스키마를 통과하는지

DoD: build/test 통과, 체크 화면에서 업로드 → 인식 결과 JSON 확인, openapi.yaml과 zod 일치.
```

---

## Phase B2. 판정 엔진 + 시연용 규정

```
`implementation-plan.md`의 5.3, 5.5~5.8, 6장, B2를 읽고 B2만 수행해줘.

1. data/rules/<airlineId>.json: 시연용 항공사 규정. 반드시 `isDemo: true`와 `note`("시연용 값이며 실제 항공사 규정이 아님"). 카테고리: 보조배터리, 무선 고데기, 액체·젤류, 라이터, 일반 전자기기. 수치를 실제 규정이라고 주장하지 마.
2. netlify/functions/_lib/engine/: evaluate(item, rules), deriveAction, buildStaffSummary — 순수 함수. 5.5 우선순위표를 그대로 구현.
   - requiredFields 누락 → 해당 쪽 NEEDS_INFO, reason에 무엇을 입력/촬영해야 하는지 명시(라벨 판독 실패 시 "라벨을 가까이 다시 촬영하거나 직접 입력"), missingFields 반환
   - Wh 계산: wh가 없고 mah·volts가 모두 있으면 wh = mah×volts÷1000(소수 둘째 자리 반올림), derivedFields.wh에 value와 basis 기록, 출처 calculated. **volts가 없으면 가정하지 말고 NEEDS_INFO**(정격 전압 또는 Wh 입력 요청)
   - 카테고리 규칙 없음 → NEEDS_INFO, confirmed:false → reason에 "사용자 확인 전", 사용자 확인 전 lookup 값은 확정에 쓰지 않음
   - **추정 안전장치(5.6)**: identification이 ai_estimated인 물품은 (a) 확인 전 reason에 "AI 추정 기반, 사용자 확인 전" 표시, (b) estimatePolicy가 never_definitive(미지정 포함)인 카테고리는 어느 쪽도 ALLOWED로 확정하지 않고 CONDITIONAL 이하로 제한, (c) allowed_with_confirm 카테고리만 confirmed:true 후 ALLOWED 가능, (d) 신뢰도 0.6 미만이면 NEEDS_INFO, (e) staffSummary에 식별 방식 표시
   - 규정 JSON에 estimatePolicy 반영: 보조배터리·무선 고데기·액체·젤류·라이터·일반 전자기기는 never_definitive, 일반 소지품(옷·책 등)만 allowed_with_confirm
   - staffSummary에 용량 값과 출처(라벨·입력·계산·조회) 표시
3. POST /api/evaluate를 실제 엔진으로 교체(스텁 제거)
4. 테스트: 조건 경계값, 계산값 경계(예: 계산 결과가 임계치 바로 아래/위), mAh만 있고 전압 없음, 규칙 없음, deriveAction 기내×위탁 16조합, 금지어 검사(예외 목록 방식), 픽스처와 실제 응답 일치, 계약 스키마
5. apps/check: 정보 보완 패널(필드 편집 시 출처 'user'로 기록), 판정 결과 표(기내/위탁/조치/missingFields/derivedFields/요약), 담은 물품 목록(여러 물품 누적, 항공사 변경 후 재판정), 시나리오 러너(6장 ①~⑮ 모두 포함, 기대값 대비 통과/실패)

DoD: 테스트·시나리오 러너 전부 통과. 보조배터리에서 mAh·V만 있을 때 Wh가 계산되어 결과가 나오고, 전압이 없으면 NEEDS_INFO가 되는 것을 체크 화면에서 확인.
계약을 바꿨다면 버전과 변경 내역을 알려줘.
```

---

## Phase B3. Gemini 인식 연동 (근접 촬영, 물품 1개)

```
`implementation-plan.md`의 1.2(P1~P4, P8~P11), 2장(촬영 모드), 5.1, 5.6, 5.9, B3을 읽고 B3만 수행해줘.

전제: 비전 제공자는 Google Gemini API 무료 티어다(@google/genai, 서버 전용).
- 환경변수: GEMINI_API_KEY, GEMINI_MODEL(모델명 하드코딩 금지), USE_DEMO_RECOGNITION, FALLBACK_TO_DEMO
- 구현 전에 공식 문서(ai.google.dev)를 확인해 이미지 입력, JSON 구조화 출력, SDK 사용법을 보고하고, 사용할 API 방식(generateContent 또는 Interactions)을 선택한 이유를 알려줘.

구현:
1. RecognitionProvider 인터페이스와 GeminiRecognitionProvider. USE_DEMO_RECOGNITION=false일 때만 사용하고 meta.isDemoRecognition도 함께 전환
2. 입력: 사진 1~3장(kind: product/label). 출력: DetectedItem 1개(zod 재검증) + multipleItemsDetected + needsLabelPhoto
3. 프롬프트 요구사항:
   - 사진에 보이는 **물품 1개**만 식별. 서로 다른 물품이 여러 개면 multipleItemsDetected=true로 알리고 값은 채우지 않음
   - 모델명/브랜드/mAh/volts/Wh/ml 등은 라벨에서 **실제로 읽히는 값만** 채우고, 읽을 수 없으면 null + unreadFields에 기록. 추측·보정·다른 사진의 값 혼용 금지
   - 라벨이 흐리거나 안 보이면 needsLabelPhoto=true
   - categoryId는 /api/categories 목록 안에서만 선택, 맞는 것이 없으면 null
   - 가능/불가 판정은 절대 하지 않음
4. mode별 동작
   - label: 위 3번 규칙. 라벨을 찾지 못하거나 읽을 수 없으면 값은 null로 두고 imageQuality.issues에 사유(blur/glare/too_far/cropped_text/dark/no_label_found)를 기록, suggestRetake 또는 suggestEstimateMode=true 반환. identification='label_read'
   - estimate: 근접샷에서 **물품 종류만** 추정. identification='ai_estimated', estimate.candidates(최대 3개, categoryId·confidence)와 estimate.basis(눈에 보이는 근거) 반환. **외형·크기로 Wh/mAh/volts/ml 등 수치를 추정하지 않는다**(사진에 인쇄된 글자가 실제로 읽힐 때만 해당 필드를 채우고 출처는 label). 브랜드·모델명을 지어내지 않는다
   - 읽어서 채운 필드의 fieldSources는 'label'. 물품이 없으면 NO_ITEM_DETECTED
5. 429 → RATE_LIMITED, 타임아웃 → UPSTREAM_TIMEOUT, 응답 스키마 불일치 → RECOGNITION_FAILED. FALLBACK_TO_DEMO=true면 실패 시 데모 응답으로 대체하되 meta로 명시
6. apps/check: "무료 키 사용 중: 업로드한 이미지가 Google에서 제품 개선에 사용될 수 있음. 민감한 정보가 찍힌 사진은 사용하지 마세요" 고지 표시(USE_DEMO_RECOGNITION=false일 때)
7. README에 수동 점검 절차 작성: 선명한 라벨 / 흐린 라벨 / 라벨 없는 물품 / 여러 물품 / 전압 없는 라벨 사진으로 확인할 체크리스트
8. 키가 번들·저장소에 없는지 확인하는 방법을 알려줘

DoD: 데모 Provider로도 기존 시나리오 통과. 실물 사진으로 인식 → 체크 화면에서 보완 → 판정까지 동작. 판독 불가 사진에서 값이 지어지지 않음.
```

---

## Phase B3.5. (선택) 제품 정보 조회

```
이 Phase는 시연 흐름(B3)이 안정된 뒤에 진행한다. 시작 전에 아래를 조사해서 나에게 보고하고 확정받아줘:
- 조회 수단 후보와 비교(예: Gemini 검색 연동 사용 가능 여부와 무료 티어 제한, 제조사 공식 페이지 조회 등) — 공식 문서 기준
- 무료 한도·데이터 정책 영향
- 출처로 인정할 기준(공식 제조사 페이지 우선 등)

확정되면 `implementation-plan.md`의 5.2, P9, B3.5 기준으로:
- POST /api/lookup 실제 구현: 후보 **여러 개** 반환(필드, sourceUrl, confidence). 못 찾으면 빈 배열. 비슷한 모델의 값으로 채우지 않기
- 선택된 후보 값은 fieldSources에 'lookup' + sourceUrl 기록, 사용자 확인 전에는 판정에서 확정값으로 쓰지 않기(엔진 규칙 반영, 테스트 추가)
- 요약(staffSummary)에 조회 출처 표시
- apps/check: 모델명으로 조회 → 후보 선택 → 반영 패널, 시나리오 추가(후보 다건, 빈 결과)
- 계약 변경이 있으면 버전과 변경 내역 기록
```

---

## Phase B4. (선택) 도감 서버 저장

```
이 Phase는 도감을 서버에 저장하기로 결정했을 때만 진행한다. 시작 전에 아래를 질문해서 확정해줘:
- 저장소(예: Netlify Blobs), 익명 기기 ID 방식, 사진 저장 여부와 보관 기간, 삭제 정책, 개인정보 고려사항

확정되면 `implementation-plan.md`의 3.1, B4 기준으로:
- contract에 CatalogCard 스키마와 /api/catalog(저장/목록/조회/삭제) 추가, 버전 올리기
- 구현 + 테스트 + apps/check 도감 패널
- 사진 저장 정책을 README에 문서화
```

---

## Phase B5. 마감 + 프론트 전달 패키지

```
`implementation-plan.md` 전체와 AGENTS.md 기준으로 현재 구현을 점검하고 B5를 수행해줘.

1. 점검표 보고(충족/미충족): P1~P11(특히 추정 결과 단정 금지, 수치 추정 금지), 5.5 조치표 일치, 단정·보장 표현 없음, 시연 플래그 노출, 필드 출처 기록, 전압 가정 없음, CORS 허용 목록, 키 노출 없음, 이미지 미저장·로그 없음, 범위 외 기능 없음
2. 미충족 항목 수정
3. README에 프론트 연동 가이드: 엔드포인트별 요청·응답 예시, **물품 단위 호출 순서**(항공사 선택 → 근접 촬영·리사이즈 → recognize → 사용자 수정/라벨 재촬영 → evaluate → 로컬 도감 저장), 이미지 규칙(1~3장, 긴 변 1280px, 총 4MB 이하), 에러 코드별 처리, labels 사용법, meta.isDemo* 처리, 필드 출처 표시, 픽스처로 로컬 목업하는 방법
4. openapi.yaml 최종 검증, contract 버전 확정
5. 시연용 → 실제 규정 교체 절차 문서화(isDemo:false, sourceUrl, updatedAt)
6. 최종 build/test/시나리오 러너 결과 보고
```

---

## 팁
- B1 완료 시점에 프론트 담당자에게 `contract/`와 배포 URL을 공유하면 병렬 작업이 가능합니다.
- 계약 변경은 프론트 담당자와 먼저 합의하고, Codex에는 "contract 먼저 수정, 버전 올리고 변경 내역 기록"을 상기시키세요.
- B3 전에 시연에 쓸 실물 사진 3~5장(선명한 라벨, 흐린 라벨, 라벨 없는 물품)을 미리 준비해 두면 인식 품질 판단이 빨라집니다.
- 시연용 항공사가 정해지면 B2 프롬프트에 이름을 채워 넣으세요.
