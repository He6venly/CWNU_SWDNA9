# v2 사용자 화면 연결

현재 진입점: apps/web/src/main.tsx → v2/TravelApp.tsx. 앱 이름은 `챙기고`입니다. 기존 App.tsx·연구용 화면·이전 IndexedDB 원본은 보존했습니다.

## Git 반영

- 기존 폴더는 .git이 없는 소스 아카이브 상태여서 로컬 codex/frontend 브랜치를 구성했습니다.
- f1aff63: 기존 프론트와 로컬 문서 보존.
- 65c7798: PR #3 head / origin/codex/backend fccb5fab706d8c3288a7f5f4d4ed7198f7c2dd43 병합. main만 받은 결과가 아닙니다.
- docs/DECISIONS.md 충돌은 프론트·백엔드 기록을 모두 남겨 해결했습니다. API·공용 계약·체크 화면은 PR 원본과 동일합니다.
- GitHub 조회 시 PR #3은 merged=true였습니다. 그래도 작업 기준은 명시한 PR head입니다. 원격 push·배포는 하지 않았습니다.

## 로컬 실행

Node 24 / npm 11, 루트에서:

```sh
npm ci
npm run dev
# 다른 터미널
npm --prefix apps/web run dev
```

- 사용자: http://127.0.0.1:5174
- 내부 체크/API: http://127.0.0.1:5173
- apps/web 전용 Vite 프록시가 /api를 5173으로 전달합니다. 로컬 프록시의 Origin도 5173으로 설정해 백엔드 기본 출처 정책에 맞춥니다. 원격 배포용 설정이 아닙니다.
- 루트 공용 설정은 프론트 구현으로 바꾸지 않았습니다. 키·Gemini 환경변수는 서버에서만 설정하며 이 프론트는 실호출을 활성화하지 않습니다.

## 구현 및 교체 지점

- api.ts: contract/v2 클라이언트 단일 생성 지점. 실제 /api/v2 호출. 자동 재시도 없음.
- useTravelWorkbench.ts: 비동기 요청·취소·입력 변경 시 결과 폐기·제품 후보 적용·저장 상태. 화면 선택이나 입력 변경으로 AI 호출하지 않음.
- PhotoSection/PhotoPicker/image: 기존 이미지 변환 기준 재사용, 전체 1장/개별 3장, 보관함 선택·미리보기·삭제·전체 교체. 사진 선택만으로 분석하지 않음. 분석 버튼만 실제 인식 호출.
- image.worker/recognitionCache: 전처리는 Worker에서 실행하고 밝기·흐림을 먼저 경고. 라벨은 보수적 자동 크롭과 높은 해상도·품질을 우선. 동일 사진·분석 입력은 5분간 재사용하며 연결 상태 새로 확인 시 캐시를 비움.
- LabelSupplement/mergeLabel: 인식 목록의 개별 항목에 라벨 사진을 추가해 빈 사양만 보완. 기존 사용자 값·수량은 보존하고 재확인을 요구.
- ItemEditorV2/DetailsEditor: 6개 분류, 계약 details·안전 정보·수량·전압 출처·사용자 확인. 제품 후보는 공용 applyCandidate로 빈 값만 적용. 검색 제안 HTML은 스크립트 없는 sandbox iframe.
- ResultCard: detailed presentation.conditions/requiredInfo/sources 직접 표시. reason 분석·규정 재계산 없음. ADJUST_QUANTITY 조건 코드가 있으면 현재 구성 불가 및 재판정 안내.
- catalogStore.ts: 새 v2 IndexedDB travel-bag-web-v2. 계약 카드와 사진 Blob, 판정 당시 전체 ItemInfo 스냅샷을 함께 저장. strict 계약을 바꾸지 않고 로컬 저장 확장으로만 스냅샷 추가. 기존 travel-bag-web DB를 덮어쓰지 않음.
- Catalog/StaffCard/useCatalogPhotos: 저장 기록·상세·한영 직원 제시·사진·사양·판정 시각·규정 기준일·버전. 규정 변경/기한 초과는 재확인 안내. 기존 도감은 LegacyCatalog에서 읽기 전용.
- TravelAlbum: 확인한 목록·사진·메모를 브라우저에 여행별 저장. 다음 여행 복사 시 새 직접 입력 초안으로 만들고 재판정하도록 확인 상태를 해제.
- ui.css: 네이비·스카이블루 항공 여행 톤, `짐 반입 확인`·`여행 준비함` 2화면, 카드형 사진 분석·빠른 확인·앨범·도감 UI. `챙기고` 로고 슬롯과 기능별 색상 아이콘을 포함하며 특정 항공사 상표는 사용하지 않음.

## 검증 범위

- npm run check: 최신 기존 테스트 163개·린트·타입·체크 화면 빌드 통과.
- npm --prefix apps/web run build: v2 사용자 화면 타입·빌드 통과.
- Chrome 헤드리스 360px: 실제 로컬 metadata/evaluate(detailed) 및 저장·직원 화면, 수정 후 결과 폐기·사용자 확인 해제, 자동 인식/조회 호출 없음 확인. 인식·조회는 공용 목업 응답을 브라우저에서 주입해 후보 적용 확인. 유료 AI 호출 없음.
- Chrome 390px: 실제 규정 액체 사례에서 조건부 가능·구조화 조건 수신, 도감 저장·새로고침 재조회·직원 화면 확인. 가로 넘침 없음.
- 실제 제품 사진의 AI 정확도, 실제 휴대폰, 규정의 정확성/최신성, 배포 환경은 미검증. 409/시간초과/저장공간 부족 처리 경로는 구현했지만 이번 브라우저 검증에서 모두 강제로 재현하지 않았습니다.
