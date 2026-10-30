# Codex 프롬프트 세트 v3 (백엔드 + 시연 체크 화면)

사용법: 저장소 루트에 `implementation-plan.md`와 `AGENTS.md`를 두고 Phase를 순서대로 하나씩 실행합니다. 각 Phase가 끝나면 결과를 확인하고 다음으로 넘어갑니다. 사용자용 프론트(디자인)는 이 저장소의 범위가 아닙니다.

---

## 0. AGENTS.md (먼저 저장소 루트에 넣기)

```md
# 작업 규칙

- 기준 문서는 `implementation-plan.md`. 작업 전 읽고, 다르게 구현해야 하면 이유를 먼저 보고한다.
- 범위는 **백엔드 API, contract, 시연 체크 화면(apps/check)** 뿐이다. 사용자용 프론트/디자인 UI는 만들지 않는다. 체크 화면은 기능 확인용이므로 스타일을 꾸미지 않는다.
- Phase 단위로만 작업한다. 예약, 일정 추천, 긴급 신고, 로그인 등은 추가하지 않는다.
- **계약 우선**: 엔드포인트를 바꾸기 전에 `contract/`(types, schemas, openapi.yaml, labels, fixtures)를 먼저 수정하고 버전과 변경 내역을 기록한다.
- 인식(AI)과 판정(규정)을 분리한다. 판정 엔진은 순수 함수로 두고 테스트를 함께 작성한다.
- 모델명·용량 등 제품 정보를 읽지 못하면 만들어내지 않는다. `null` + `unreadFields`로 반환한다.
- 실제 AI·최신 항공사 규정이 없는 부분은 응답 `meta.isDemo*`와 데이터 `isDemo: true`로 명시한다. 규정 수치를 기억·추측으로 사실처럼 쓰지 않는다.
- API가 만드는 모든 문구에 "통과", "허가", "문제없음", "보장" 같은 표현을 쓰지 않는다. 금지어 테스트를 유지한다.
- 서버는 사진을 저장하지 않고, 로그에 이미지·개인정보를 남기지 않는다.
- API 키·시크릿은 코드·번들·커밋에 넣지 않는다 (Netlify 환경변수).
- Netlify Functions 사용법과 한도(요청 크기, 실행 시간)는 작성 전에 현재 공식 문서를 확인하고, 확인한 내용을 보고한다.
- 새 의존성은 최소화하고 이유를 요약에 적는다.
- 작업 끝에 보고: 변경 파일, build/test 결과, DoD 충족 여부, 남은 이슈.
```

---

## Phase B0. 세팅 + 배포

```
`implementation-plan.md`의 1~3장, 4.8, B0를 읽고 B0만 수행해줘.

- 3장 저장소 구조대로 폴더 생성 (contract/, netlify/functions/, data/rules/, apps/check/, test/)
- TypeScript, Vitest, zod 설정. apps/check는 Vite + React + TypeScript로 초기화만(내용은 B1)
- Netlify Functions는 모던 방식(`export default async (req: Request) => Response` + `export const config = { path: ... }`)으로 작성. 공식 문서를 확인하고 필요하면 방식을 조정한 뒤 이유를 알려줘.
- netlify.toml: 빌드 명령, publish(apps/check 빌드 결과), functions 디렉토리, `/api/*` 라우팅
- `GET /api/health` 구현: `{ ok: true, time }`
- `_lib/cors.ts`(ALLOWED_ORIGINS 환경변수 기반), `_lib/errors.ts`(공통 에러 형식 `{error:{code,message}}`)
- README에 Netlify 연결·환경변수 목록(ALLOWED_ORIGINS, USE_DEMO_RECOGNITION, VISION_API_KEY) 정리

DoD: build/test 통과, 로컬 실행 방법(`netlify dev` 등)과 /api/health 확인 방법을 알려줘.
```

---

## Phase B1. 계약 + 스텁 API + 체크 화면 골격

```
`implementation-plan.md`의 4장 전체(4.1~4.7), 5장, B1을 읽고 B1만 수행해줘. 이 Phase의 목표는 프론트 팀이 스텁과 픽스처만으로 개발을 시작할 수 있게 하는 것이다.

1. contract/ 작성
   - types.ts, schemas.ts(zod: 모든 요청/응답), openapi.yaml(4장의 엔드포인트), contractVersion `1.0.0`
   - labels.ts: 결과 라벨(가능/조건부 가능/불가/제품 정보 확인 필요), 조치 라벨(기내에 넣기/위탁하기/조건 확인하기/가져가지 않기), 시연 배너 문구("시연용 화면입니다. 실제 AI 인식·항공사 최신 규정과 연결되어 있지 않습니다."), 참고용 안내 문구("이 화면은 물품 정보를 보여주는 참고용입니다. 공항 보안검색 통과나 반입 허가를 보장하지 않으며, 최종 판단은 항공사와 보안검색 직원의 기준을 따릅니다.")
   - fixtures/: 시나리오별 요청·응답 JSON (보조배터리 모델 미확인, 무선 고데기, 샴푸, 일반 케이블, 인식 0건, 에러 예시)
2. 엔드포인트 구현 (모두 응답에 meta 포함): GET /api/meta, /api/airlines(활성 1개 + 준비 중 1~2개), /api/categories?airlineId=, POST /api/recognize(DemoRecognitionProvider: 이미지와 무관하게 고정 샘플, isDemo true), POST /api/evaluate(이 Phase는 고정 응답 스텁, 입력/출력은 스키마 검증)
3. 잘못된 요청은 INVALID_REQUEST, 알 수 없는 항공사는 UNKNOWN_AIRLINE, 큰 본문은 PAYLOAD_TOO_LARGE
4. apps/check 골격: 상태 패널(health/meta, 시연 플래그), 인식 테스트(이미지 업로드 시 긴 변 1280px로 리사이즈 후 호출), 요청/응답 JSON 뷰어. 스타일은 기본 수준.
5. 계약 테스트: 모든 픽스처가 zod 스키마를 통과하는지

DoD: build/test 통과, 체크 화면에서 업로드 → 인식 샘플 4개 JSON 확인, openapi.yaml과 zod가 일치.
```

---

## Phase B2. 판정 엔진 + 시연용 규정

```
`implementation-plan.md`의 4.4~4.7, 5장, B2를 읽고 B2만 수행해줘.

1. data/rules/<airlineId>.json: 시연용 항공사 규정. 반드시 `isDemo: true`와 파일 내 `note`("시연용 값이며 실제 항공사 규정이 아님"). 카테고리: 보조배터리, 무선 고데기, 액체·젤류, 라이터, 일반 전자기기. 수치를 실제 규정이라고 주장하지 마.
2. netlify/functions/_lib/engine/: evaluate(item, rules), deriveAction, buildStaffSummary — 모두 순수 함수. 4.4 우선순위표를 그대로 구현.
   - requiredFields 누락 → 해당 쪽 NEEDS_INFO + reason에 입력해야 할 항목 명시, missingFields 반환
   - 카테고리 규칙 없음 → NEEDS_INFO
   - confirmed:false → reason에 "사용자 확인 전" 표기
3. POST /api/evaluate를 실제 엔진으로 교체 (스텁 제거). 응답에 staffSummary, isDemo 포함.
4. 테스트: 조건 경계값, 정보 누락, 규칙 없음, deriveAction 기내×위탁 16조합 전부, 금지어 검사("통과/허가/문제없음/보장"이 reason·staffSummary·labels에 없음), 픽스처와 실제 응답 일치
5. apps/check: 물품 편집 패널(이름·카테고리·모델명·Wh/ml·확인 체크), 판정 결과 표(기내/위탁/조치/missingFields/요약), 시나리오 러너(픽스처 기반, 기대값 대비 통과/실패 표시). 5장의 필수 시나리오 7개를 모두 포함.

DoD: 테스트 전부 통과, 시나리오 러너 전부 통과, 보조배터리에 Wh를 입력하기 전/후로 결과가 달라지는 것을 체크 화면에서 확인.
계약을 바꿨다면 contract 버전과 변경 내역을 알려줘.
```

---

## Phase B3. 실제 AI 인식 연동

```
`implementation-plan.md`의 1.2(P1~P4, P8), 4.1, 4.8, B3을 읽고 B3만 수행해줘.

전제: 비전 API 제공자는 내가 정해서 알려줄게({제공자/모델}). 지금은 제공자 호출 부분만 한 함수로 분리해서 교체 가능하게 만들어줘.

1. RecognitionProvider 인터페이스와 ApiRecognitionProvider 구현. USE_DEMO_RECOGNITION=false일 때만 사용, 응답 meta.isDemoRecognition도 함께 전환
2. 비전 호출 프롬프트 요구사항:
   - 사진에 보이는 물품만 나열
   - 모델명/Wh/mAh/volts/ml 등은 라벨에서 실제로 읽히는 값만 채우고, 읽을 수 없으면 null로 두고 unreadFields에 기록. 추측·보정 금지
   - categoryId는 /api/categories의 목록 안에서만 선택, 맞는 것이 없으면 null
   - 판정(가능/불가)은 절대 포함하지 않음 (P1)
3. 비전 응답을 zod로 검증하고 실패 시 RECOGNITION_FAILED. 타임아웃 시 UPSTREAM_TIMEOUT. 서버 본문 상한(예: 4MB), 이미지 미저장·로그 금지
4. 시나리오 추가: 모델명이 보이지 않는 사진에서 modelName이 null로 반환되는지 확인하는 수동 점검 절차를 README에 문서화 (자동화가 어려우면 체크 화면에 "판독 불가 확인" 체크 항목으로)
5. 키가 번들·저장소에 없는지 확인하는 방법을 알려줘

DoD: 데모 Provider로도 기존 시나리오가 그대로 통과, 실제 사진으로 인식 → 체크 화면 보정 → 판정까지 동작.
```

---

## Phase B4. (선택) 도감 서버 저장

```
이 Phase는 도감을 서버에 저장하기로 결정했을 때만 진행한다. 시작 전에 아래를 나에게 질문해서 확정해줘:
- 저장소 선택(예: Netlify Blobs), 익명 기기 ID 방식, 사진 저장 여부와 보관 기간, 삭제 정책, 개인정보 고려사항

확정되면 `implementation-plan.md`의 2.1, B4 기준으로:
- contract에 CatalogCard 스키마와 /api/catalog(저장/목록/조회/삭제) 추가, 버전 올리기
- 구현 + 테스트 + apps/check에 도감 패널 추가
- 사진 저장 정책을 README에 문서화
```

---

## Phase B5. 마감 + 프론트 전달 패키지

```
`implementation-plan.md` 전체와 AGENTS.md 기준으로 현재 구현을 점검하고 B5를 수행해줘.

1. 점검표 보고 (충족/미충족): P1~P8, 4.4 조치표 일치, 금지어 없음, 시연 플래그 노출, CORS 허용 목록 동작, 키 노출 없음, 이미지 미저장·로그 없음, 범위 외 기능 없음
2. 미충족 항목 수정
3. README에 프론트 연동 가이드 작성: 엔드포인트별 요청·응답 예시, 호출 순서(항공사 선택 → 리사이즈 → recognize → 사용자 수정 → evaluate), 이미지 리사이즈 규칙, 에러 코드와 처리 방법, labels 사용법, meta.isDemo* 처리, 로컬 목업 방법(fixtures)
4. openapi.yaml 최종 검증(스키마와 일치), contract 버전 확정
5. 시연용 → 실제 규정 교체 절차 문서화 (isDemo:false, sourceUrl, updatedAt)
6. 최종 build/test/시나리오 러너 결과 보고
```

---

## 팁
- B1이 끝나는 시점에 프론트 담당자에게 `contract/`와 배포 URL을 먼저 공유하면 병렬 작업이 가능합니다.
- 계약을 바꿔야 할 때는 프론트 담당자와 먼저 합의하고, Codex에는 "contract 먼저 수정, 버전 올리고 변경 내역 기록"을 다시 상기시키세요.
- B3의 `{제공자/모델}` 자리와 시연용 항공사는 정해지면 해당 프롬프트에 채워 넣으세요.
