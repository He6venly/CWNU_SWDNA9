export const labels = {
  title: '여행 짐 반입 확인',
  verdicts: {
    ALLOWED: '가능', CONDITIONAL: '조건부 가능',
    PROHIBITED: '불가', NEEDS_INFO: '제품 정보 확인 필요',
  },
  actions: {
    PUT_IN_CABIN: '기내에 넣기', PUT_IN_CHECKED: '위탁하기',
    CHECK_CONDITIONS: '조건 확인하기', LEAVE_BEHIND: '가져가지 않기',
  },
  fields: { modelName: '모델명', wh: '용량(Wh)', mah: '용량(mAh)', volts: '전압(V)', ml: '용량(mL)', count: '수량' },
  demoBanner: '시연용 화면입니다. 실제 AI 인식·항공사 최신 규정과 연결되어 있지 않습니다.',
  stubBanner: '현재 판정 API는 고정 응답입니다. 입력값에 따른 실제 판정은 아직 수행하지 않습니다.',
  referenceNotice: '이 화면은 물품 정보를 보여주는 참고용입니다. 공항 보안검색 통과나 반입 허가를 보장하지 않으며, 최종 판단은 항공사와 보안검색 직원의 기준을 따릅니다.',
  productNotice: '검색된 제품 정보는 후보 정보입니다. 사진의 모델·제품 라벨과 일치하는지 확인해 주세요.',
} as const
