# 개발 결정 기록

## 2026-10-30 초기 환경

| 구분 | 내용 | 이유·근거 |
| --- | --- | --- |
| 사용자 요구 | 아이디어 기반 웹앱, 주제 미정 | 사용자 요청 |
| 확인 사실 | 원격에는 최초 README만 존재 | 복제 직후 파일 확인 |
| 설계 선택 | React + TypeScript + Vite | 화면과 상호작용을 빠르게 구현하고 정적 빌드 가능 |
| 설계 선택 | Node.js 24 LTS + npm | 설치된 Node.js 24.14.0, npm 11.9.0 활용. 팀 런타임은 24 계열로 통일 |
| 설계 선택 | 공식 react-ts 템플릿·lockfile 사용 | 설정을 최소화하고 의존성 설치 재현성 확보 |
| 설계 선택 | 타입 검사·Oxlint·빌드 및 CI 구성 | 팀 병합 전 기본 오류 검출. 최신 공식 템플릿의 Oxlint 설정 사용 |
| 설계 선택 | 초기 작업 브랜치 chore/project-setup | main에 바로 수정 사항을 섞지 않고 검토 가능 |
| 보류 | 백엔드·DB·로그인·라우터·AI API·호스팅 | 주제·데이터·예산이 정해진 뒤 필요 여부 판단 |
| 미검증 | 실제 배포 및 Git CLI 푸시 인증 | 복제와 GitHub 연결 권한 확인은 푸시·배포 성공을 보장하지 않음 |
| 검증 완료 | npm install, npm run check | 의존성 설치, Oxlint, TypeScript 검사, 프로덕션 빌드 성공 |
| 검증 완료 | 로컬 개발 서버 HTML·React 모듈 HTTP 200 | 127.0.0.1:5173에서 응답 확인. 브라우저 화면 검수와는 별개 |
| 미검증 | GitHub Actions 원격 실행 | 워크플로 파일만 구성. 커밋·푸시 전이므로 원격 실행 결과 없음 |

주제나 핵심 기능은 임의로 확정하지 않음. 새 의존성·서버·유료 서비스가 필요해지면 이유와 범위를 추가 기록.

설정 참고: [Vite 공식 시작 안내](https://vite.dev/guide/), [setup-node 공식 사용법](https://github.com/actions/setup-node), [checkout 공식 사용법](https://github.com/actions/checkout).

## 2026-10-30 Netlify 배포 조건 반영

초기 호스팅 보류 결정을 아래 요구와 선택으로 대체.

| 구분 | 내용 | 이유·근거 |
| --- | --- | --- |
| 필수 요구사항 | Netlify에 배포 | 사용자 추가 요구. OT 텍스트에서 확인된 조건과 구분 |
| 설계 선택 | React + TypeScript + Vite 유지, `dist/` 정적 배포 | 기존 구성이 Netlify에서 지원되므로 프레임워크 교체·추가 의존성 불필요 |
| 설계 선택 | 루트 `netlify.toml`, 빌드 명령 `npm run check` | 배포 설정을 코드로 관리하고 lint·타입 검사·빌드 실패 시 배포 차단 |
| 설계 선택 | Node.js 24, npm 11 명시 | 기존 로컬 런타임·package.json 조건과 일치 |
| 설계 선택 | `/*` → `/index.html` 상태 200 rewrite | 클라이언트 경로 직접 접속·새로고침 지원. 강제 덮어쓰기 없이 정적 파일 우선. 라우터 도입은 별도 결정 |
| 설계 선택 | GitHub 운영 브랜치 `main` 연동 방식 안내 | 병합된 소스를 기준으로 Netlify 자동 배포 가능. 실제 연결은 미수행 |
| 보류 | 백엔드·DB·로그인·AI API | 주제·데이터·예산 확정 후 판단. 서버가 필요하면 Netlify Functions 등 검토 |
| 검증 완료 | `npm run check` 통과 | 로컬 Node.js 24.14.0, npm 11.9.0에서 lint·타입 검사·프로덕션 빌드 성공, `dist/` 생성 |
| 미검증 | Netlify 프로젝트 연결·원격 빌드·공개 URL·배포 환경 rewrite | 로컬 검사로 실제 Netlify 동작을 보장할 수 없음 |

근거: [Netlify Vite 안내](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/), [파일 기반 설정](https://docs.netlify.com/build/configure-builds/file-based-configuration/), [런타임 버전 설정](https://docs.netlify.com/build/configure-builds/manage-dependencies/).

## 2026-10-30 프론트 병렬 개발 준비 — B0/B1

| 구분 | 내용 | 이유·근거 |
| --- | --- | --- |
| 필수 요구사항 | 백엔드·기능 확인용 최소 화면에 집중, 사용자 프론트는 별도 작업 | 사용자 직접 지시 |
| 필수 요구사항 | Gemini로 사진 인식·제품 정보 조회·항공사 규정 대조 연결 준비 | 사용자 추가 지시. 제공자 미정 상태를 대체 |
| 설계 선택 | contract 1.0.0, health 포함 공통 meta, 오류 형식 통일 | 엔드포인트보다 먼저 프론트 연동 기준 고정 |
| 설계 선택 | 별도 resolve-product API와 검색 후보·출처·사용자 확인 상태 | 사진 판독값과 검색된 제품 사양을 혼동하지 않고 UI 병렬 개발 가능 |
| 설계 선택 | 기내·위탁별 requiredFields, 규정 구간 중첩 거부 | 누락 정보로 이미 확정된 불가가 사라지는 문제 및 조건 순서 의존성 방지 |
| 설계 선택 | 고정 부정 안내와 생성 판정 문구 검사를 분리 | 필수 안내에 포함된 통과·허가·보장 단어를 잘못 차단하지 않음 |
| 설계 선택 | 실제 API는 시연·스텁, 결과 예시는 별도 fixture·mock client | 디자인 작업이 실제 판정 엔진을 기다리지 않으며 기능 상태를 오인하지 않는 구성 |
| 설계 선택 | 기존 src·index.html 보존, apps/check를 새 빌드 진입점으로 지정 | 기존 작업 보존, 프론트 담당과 수정 범위 구분 |
| 설계 선택 | 단일 Functions 진입점 + 경량 경로 분기, 전체 SPA rewrite 제거 | 7개 API에 공통 검증 적용, API 오류의 HTML 응답 방지. 개별 엔드포인트 파일 반복 생략 |
| 설계 선택 | Zod·Vitest·Netlify 함수 타입 추가, 단일 lockfile 유지 | 스키마·타입·명세 중복과 프레임워크 의존성 최소화 |
| 실행 실패 후 대안 | Netlify CLI 설치는 레지스트리 idle timeout으로 실패, 의존성에서 제외 | 동일 Request→Response 핸들러를 Vite 로컬 middleware로 실행. Functions 번들·원격 동작 검증과는 구분 |
| 설계 선택 | Gemini 서버 어댑터 구현, 현재 라우터 연결은 잠금 | 실제 모델·키·공식 규정·남용/비용 방어 미확정 상태에서 유료 호출 방지. 환경변수만으로 자동 활성화하지 않음 |
| 설계 선택 | Gemini 어댑터는 fetch·store:false·20초 제한·자동 재시도 없음 | SDK 의존성·반복 호출 비용·불필요한 상태 저장 최소화. 제공자 데이터 정책은 별도 확인 |
| 설계 선택 | 제품 후보는 grounding 인용 URL과 대조, 모델 미확인 시 검색 생략 | 임의 제품 사양·출처 생성 억제, 불필요한 검색 비용 방지 |
| 미완료 | 실규정 기반 판정·Gemini 실사진 호출·Netlify 원격 배포 | 이번 범위는 프론트 인계용 계약·스텁·연결 준비. 최신 검증 결과는 docs/VALIDATION.md 참고 |

계약 변경 기준과 해소한 충돌은 contract/README.md·CHANGELOG.md에 기록. 프론트 인계 문서는 docs/FRONTEND_HANDOFF.md.

공식 확인: [Netlify Functions API](https://docs.netlify.com/build/functions/api/), [Zod JSON Schema](https://zod.dev/json-schema), [Gemini 구조화 출력](https://ai.google.dev/gemini-api/docs/structured-output), [검색 grounding](https://ai.google.dev/gemini-api/docs/google-search), [Interactions 저장 옵션](https://ai.google.dev/gemini-api/docs/interactions-overview).

## 2026-10-30 새 촬영 구조·비용 최적화 검토

- 사용자 확정: 최종 판정은 알고리즘, Gemini는 사진 인식·제품 정보 조회. 앞선 Gemini 판정 계획을 대체
- 사용자 확정: 전체 짐/개별 사진 2종으로 진입. 원문의 전체 사진 제외 조건보다 사용자 직접 지시 우선
- 설계 제안: overview/detail과 detail의 label/estimate를 분리. 전처리·출처·계산 필드를 포함한 계약 2.0.0 전환. 기존 1.0.0은 동작 기반으로 보존
- 검토 결과: 전처리의 실제 절감량 측정, 공칭 전압 확인, 판정 전 반올림 금지, 다중 물품의 모드별 처리·lookup 명칭·무인식 응답 통일 필요
- 검토 문서: docs/SPEC_REVIEW.md. 첨부 원문은 docs/reference/에 보존. 계약·기능은 이번 검토만으로 변경 완료 처리하지 않음
- Git 공유는 별도 공통 기반 개발 브랜치. 새 명세 적용 및 main 반영은 별도 상태로 구분

## 2026-10-30 백엔드 작업 분리·모바일 웹

- 사용자 요구: 프론트와 분리해 백엔드 개발. 공통 기반에서 로컬 codex/backend 브랜치 생성, 기존 파일 보존
- 사용자 요구: PC 웹과 모바일 브라우저 지원 필수. 모바일 촬영·업로드·입력·결과 조회·응답성과 실패 경로를 검증 대상으로 지정
- 확인 사실: 현재 백엔드에는 DB 연결·서버 사진 저장·도감 저장 API 없음. 규정은 JSON 데이터로 제공할 계획
- 기존 설계 유지: 도감은 프론트의 브라우저 IndexedDB. 자체 운영 DB나 서버 DB가 아니며 계정 기반 동기화는 현재 미구현. 별도 프론트 작업의 실제 저장 구현 상태는 이 저장소 점검으로 확인하지 못함

## 2026-10-30 기존 사진 등록 기본 흐름

- 사용자 요구: 이미 찍어 둔 사진을 등록하는 웹 흐름 선호. 카메라 권한·앱 내 촬영을 필수 조건으로 두지 않음
- 설계 선택: 사진 보관함·파일 선택 → 미리보기·필요한 크롭·품질 확인 → 분석 요청. 전체/개별 사진 분석 구분은 유지
- 구현: 체크 화면 파일 입력의 capture 속성을 제거하고 기존 사진 선택 안내 추가. 사용자용 프론트는 별도 담당이므로 인계 문서에 반영
- 범위 구분: 등록 방식 변경은 사진 출처 선택의 변경이며 계약 2.0.0의 전체/개별 분석 기능 구현 완료를 의미하지 않음

## 2026-10-30 계약 2.0.0·시연 API 구현

| 구분 | 내용 | 이유·상태 |
| --- | --- | --- |
| 사용자 확정 | 첫 실제 항공사 대한항공, 국내선·국제선 선택 | 실제 규정 연결은 아직 전. 준비 중 항공사는 비활성 |
| 사용자 확정 | 한국 국내선·한국 출발 국제선 | 출발국 KR 명시, 해외 출발은 현 범위에서 거부 |
| 설계 선택 | contract/v2와 /api/v2 병행 | 이미 진행 중인 프론트의 1.0 호출·목업을 깨뜨리지 않고 전환 가능 |
| 설계 선택 | 전체 1장 다건, 개별 1~3장 단건 | 같은 items 배열 응답, label/estimate와 이미지 kind·targetItemId 연결 검증 |
| 설계 선택 | 필드별 출처·확인·공칭/출력 전압, 추정 후보 | 제품 값 생성 경로를 표시하고 향후 계산·규정 엔진 안전 검증에 활용 |
| 설계 선택 | 인식에서 항공사 제거, 판정에 노선·출발국 추가 | 항공사·노선 변경 시 불필요한 사진 재인식 방지 |
| 설계 선택 | 이미지 품질 source=demo·usable=null | 현재 사진 품질을 측정하지 않으므로 검사 완료로 가장하지 않음 |
| 설계 선택 | 2.0 lookup, 기존 resolve-product 유지 | 신규 문서와 명칭 일치, 원래 프론트 API 호환성 유지 |
| 설계 선택 | 두 버전 OpenAPI 공통 생성기, 신규 의존성 없음 | 명세 중복 관리·추가 비용 최소화. 1.0 입출력 유지 |
| 설계 선택 | 3장 압축 예산 배분 + 전송 전 JSON 바이트 검사 | 사진별 상한 안이어도 base64 총량이 4MiB를 넘는 문제에 대응 |
| 구현 범위 | 계약·목업·시연 스텁·체크 화면 | 실제 Gemini·조회·규정 엔진·Wh 계산은 미연결 |
| 검증 완료 | npm run check 98개 테스트·타입·빌드, 두 버전 실제 로컬 HTTP | docs/VALIDATION_V2.md 참고 |
| 검증 불가 | 새 화면 파일 등록·모바일 흐름 | 내부 브라우저 네트워크 중단. 서버·타입·단위 테스트 성공으로 UI 성공을 대체하지 않음 |

최신 프론트 전환 안내: docs/FRONTEND_HANDOFF_V2.md. 사용자용 프론트 파일은 수정하지 않음. 기존 사진 등록·모바일 웹 요구를 반영하되 실제 실기기 검수는 별도 필요.
