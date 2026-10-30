# 16개 항공사 규정 엔진 — 2026-10-31

## 적용 범위

지원 항공사 직접 운항편의 한국 국내선·한국 출발 국제선, 여행자 1명 기준. 공동운항·환승·해외 출발·목적지 세관/검역·수하물 크기/무게는 별도 확인 대상이다.

지원 항공사: 대한항공, 아시아나항공, 제주항공, 진에어, 에어부산, 이스타항공, 티웨이항공, 에어서울, 에어프레미아, 에어로케이, 파라타항공, 중국남방항공, 중국동방항공, 중국국제항공, 베트남항공, 델타항공.

## 구현 기준

- 항공사별 공식 출처·규정 버전·노선·배터리 용량/수량·라이터 허용 수량을 `data/rules/airline-profiles.json`에서 관리한다.
- 대한항공 규칙을 다른 항공사에 재사용하지 않는다. 베트남항공·델타항공 보조배터리는 100Wh 이하, 나머지는 160Wh 이하 기준을 적용한다.
- 중국남방항공·중국동방항공·중국국제항공은 라이터·성냥 기내 휴대를 불가 처리한다.
- 한국 공통 액체·보조배터리 보안 기준은 인천공항·국토교통부 자료를 함께 적용한다.
- 에어로케이·파라타항공은 공식 사이트에서 세부 제한 페이지를 확인하지 못해 국토교통부 한국 항공사 공통 지침을 보수적으로 적용한다.
- 6개 분류: 보조배터리, 무선 고데기, 액체, 라이터, 전자기기, 일반 소지품.
- 확인된 사용자 입력만 판정에 사용한다. 용량·수량·안전 상태 미확인은 `NEEDS_INFO`다.
- 규정 검수 기한은 2026-11-30 00:00 UTC 전까지다. 기한이 지나면 전체 항공사를 비활성화하고 자동 판정을 중단한다.

## 주요 출처

각 항공사의 전체 출처는 `GET /api/v2/rules?airlineId=...` 응답에서 제공한다.

- [대한항공 운송 제한 물품](https://www.koreanair.com/contents/plan-your-travel/baggage/restricted-item)
- [아시아나항공 운송 제한 물품](https://flyasiana.com/C/KR/KO/contents/restricted-transport-items)
- [제주항공 운송 제한 물품](https://www.jejuair.net/en/linkService/boardingProcessGuide/transportLimitation.do)
- [에어부산 운송 제한 물품](https://www.airbusan.com/content/common/service/baggage/restriction)
- [중국남방항공 리튬배터리 안내](https://www.csair.com/newh5/en/tourguide/booking/orders/order/battery/)
- [중국동방항공 리튬배터리 안내](https://global.ceair.com/global/en_static/Announcement/BaggageService/RegulationsonSafeTransportationofLithiumBatteries/)
- [중국국제항공 보조배터리 안내](https://www.airchina.com.cn/zh-CN/content/c/2026-08-04/30035.shtml)
- [베트남항공 리튬배터리 안내](https://www.vietnamairlines.com/ca/en/travel-information/baggage/restricted-baggage/pin-lithium)
- [델타항공 배터리 제한](https://www.delta.com/ca/en/baggage/prohibited-or-restricted-items/battery-or-fuel-powered)

## 검증 기준

- `npm run check`
- 16개 항공사 목록·규정 메타데이터·평가 API가 모두 성공해야 한다.
- 아시아나항공 120Wh 보조배터리는 조건부, 델타항공 120Wh 보조배터리는 불가여야 한다.
- 중국 항공사 라이터와 대한항공 라이터 결과가 달라야 한다.
- `trinity-airways`·`트리니티항공` 문자열이 없어야 한다.
