# 계약 2.0.0

## 2026-10-30

- 1.0.0은 유지하고 contract/v2, /api/v2 경로 병행 제공
- 전체 기존 사진 1장 / 개별 사진 1~3장, 라벨/추정 구분과 targetItemId 연결
- brand·필드 출처·공칭/출력 전압 구분·추정 후보·이미지별 품질 상태 추가
- 인식에서 항공사 의존성 제거. categories·evaluate에 domestic/international 필수
- 대한항공 실규정 연결 준비 상태 명시. 현재 시연 항공사만 사용 가능
- 사용자 선택에 따라 한국 국내선·한국 출발 국제선으로 한정. departureCountry=KR 명시, 해외 출발 미지원
- lookup 경로와 조회 시연 플래그 추가. 무인식은 200 items:[] + 안내
- 판정용 ruleVersion·계산값 구조·프론트 저장용 복수 photoKeys 제공
- 실제 인식·검색·판정·계산은 미연결이며 버전별 기능 상태 명시
