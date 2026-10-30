# CWNU_SWDNA9

2026 CWNU SW-DNA² 챌린지 웹앱 개발 저장소. 임시 제목: 여행 짐 반입 확인.

**[배포 서비스 바로가기](https://cheerful-sundae-3a0b77.netlify.app/)**

[![챙기고 서비스 미리보기](https://cheerful-sundae-3a0b77.netlify.app/social-preview.png)](https://cheerful-sundae-3a0b77.netlify.app/)

최신 기준: [계약 2.0.0](contract/v2/README.md), [규정 엔진](docs/RULE_ENGINE.md), [프론트 추가 인계](docs/FRONTEND_RULES_HANDOFF.md). API는 `/api/v2`, 기존 `/api`는 1.0.0으로 유지. 16개 항공사 직접 운항편·한국 출발·여행자 1명·6개 분류 규정 판정 지원. 사진 인식은 Gemini, 제품 조회는 Tavily를 사용.

판정은 순수 알고리즘, 사진 인식은 Gemini, 선택형 제품 검색은 Tavily를 사용한다. 목 응답은 명시적으로 `USE_DEMO_RECOGNITION=true`를 설정한 개발·테스트 환경에서만 사용한다.

프론트 새 연동: [규정 입력 인계](docs/FRONTEND_RULES_HANDOFF.md), [2.0 사진 연동](docs/FRONTEND_HANDOFF_V2.md). 기존 1.0은 [이전 인계 가이드](docs/FRONTEND_HANDOFF.md)와 [이전 계약](contract/README.md)에 보존.

## 시작

Node.js 24 LTS, npm 사용. Windows PowerShell에서 실행 정책에 막히면 `npm` 대신 `npm.cmd` 사용.

```sh
npm ci
npm run dev
```

개발 주소: http://localhost:5173

```sh
npm run check      # Oxlint + 테스트 + 타입 검사 + 프로덕션 빌드
npm run preview    # 정적 체크 화면만 확인. API는 npm run dev로 실행
npm run contract:generate  # 스키마 변경 후 OpenAPI 재생성
```

## 구성

- React + TypeScript + Vite
- Oxlint, npm lockfile, GitHub Actions 검사
- `apps/check/`: 백엔드 검증용 최소 화면
- `netlify/functions/`: `/api/*` 서버 핸들러·Provider
- `contract/`: 타입·스키마·OpenAPI·문구·목업·클라이언트
- `test/`: 계약·HTTP·Gemini 어댑터·규정 형식 테스트
- `src/`, 루트 `index.html`: 기존 초기 화면 보존본. 현재 빌드 진입점은 `apps/check/`
- `docs/OT.md`: OT 요구사항·심사 기준·개발 시사점
- `docs/PROJECT_BRIEF.md`: 주제 확정용 기획 양식
- `docs/DECISIONS.md`: 기술 선택과 미정 사항
- `netlify.toml`: Netlify 빌드·배포·SPA 경로 설정

기술 선택 근거: 기존 React·Vite와 단일 npm lockfile 유지. Zod로 계약 검증·OpenAPI 생성, Vitest로 의미·오류 경로 검증. Functions 타입 패키지만 추가하고 로컬 API는 같은 핸들러를 Vite에서 실행. 네트워크 타임아웃이 발생한 대형 Netlify CLI 의존성은 제외.

## Git 협업

원격: https://github.com/He6venly/CWNU_SWDNA9.git

```sh
git fetch origin
git switch main
git pull --ff-only
git switch -c feat/기능명
```

백엔드 공유 브랜치는 `codex/backend`. 프론트의 기존 작업을 보존하며 인계 문서대로 병합. main 반영·Netlify 배포는 별도 단계.

## 환경변수·Netlify 배포

환경변수가 필요하면 `.env.example`을 복사해 `.env.local` 작성. `VITE_` 변수는 브라우저에 공개되므로 비밀키 저장 금지. AI 등 외부 서비스 비밀키는 서버에서만 사용.

필수 배포 플랫폼은 Netlify. 기존 React + TypeScript + Vite 구성을 유지하고, 저장소 루트의 `netlify.toml`로 배포 설정 관리.

| 항목 | 설정 |
| --- | --- |
| Base directory | 저장소 루트, 별도 입력 없음 |
| Build command | `npm run check && npm --prefix apps/web run build` |
| Publish directory | `apps/web/dist` |
| Node.js / npm | 24 / 11 |
| Functions directory | `netlify/functions` |
| API 경로 | 함수 `config.path`의 `/api/*` |
| SPA 경로 | 체크 화면은 `/`만 사용. API 오류가 HTML로 바뀌지 않도록 전체 경로 rewrite 제거 |

1. 변경 파일을 GitHub에 반영
2. Netlify에서 GitHub 저장소 `He6venly/CWNU_SWDNA9` 연결, 운영 브랜치 `main` 선택
3. 위 설정 확인 후 배포. 환경변수가 필요하면 Netlify 프로젝트의 Environment variables에 등록하고 재배포
4. 발급된 HTTPS 주소에서 화면·기능·새로고침 확인. 클라이언트 경로를 추가하면 해당 주소 직접 접속도 확인

Netlify에서 검사와 사용자 웹 빌드가 모두 성공한 경우에만 `apps/web/dist/`와 Functions를 배포한다. 이후 연결 브랜치 변경 시 자동 배포한다.

운영 서버 환경변수: `ALLOWED_ORIGINS`(공개 사이트 Origin), `USE_DEMO_RECOGNITION=false`, `GEMINI_CALLS_ENABLED=true`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `TAVILY_API_KEY`. 비밀키에 `VITE_` 접두사를 사용하지 않는다. Gemini 키나 모델이 누락되면 인식 요청은 503을 반환한다.

설정 근거: [Vite 배포](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/), [파일 기반 설정](https://docs.netlify.com/build/configure-builds/file-based-configuration/), [Node.js·npm 버전](https://docs.netlify.com/build/configure-builds/manage-dependencies/).

## 제출 준비

- 아이디어를 담은 웹페이지 1개와 작동 영상 또는 캡처본
- 발표자료 PDF 1개
- 꾸럼e 기획지·협업 과정 기록
- 발표 5분, 질의 3분

상세 근거는 [사전 OT](https://docs.google.com/presentation/d/1HAF1nN8eDb5coZzEnfMUg2H6eb6pN0AX3YCuZcF8xow/edit?usp=sharing)와 `docs/OT.md` 참고.
