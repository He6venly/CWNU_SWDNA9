import { labels as legacy } from '../labels.ts'
export const labels = {
  ...legacy,
  demoBanner: '인식·제품 조회 상태를 확인해 주세요. 시연 응답은 사진 내용과 무관하며, 실제 제품 정보는 라벨과 대조해 직접 확인해야 합니다.',
  stubBanner: '16개 지원 항공사는 확인한 제품 정보와 각 항공사별 검수 규정에 따른 참고 판정을 제공합니다.',
  fields: { brand: '브랜드', ...legacy.fields, ml: '용기 표시 용량(mL)' },
  sources: { label: '라벨 판독', user: '직접 입력', calculated: '계산값', lookup: '제품 정보 조회' },
  flightTypes: { domestic: '한국 국내선', international: '한국 출발 국제선' },
  captureModes: { overview: '전체 짐 사진', detail: '개별 물품 사진' },
  photoNotice: '이미 찍어 둔 사진을 보관함·파일에서 선택해 주세요. 사진 선택만으로 분석을 요청하지 않습니다.',
} as const
