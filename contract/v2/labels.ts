import { labels as legacy } from '../labels.ts'
export const labels = {
  ...legacy,
  fields: { brand: '브랜드', ...legacy.fields },
  sources: { label: '라벨 판독', user: '직접 입력', calculated: '계산값', lookup: '제품 정보 조회' },
  flightTypes: { domestic: '한국 국내선', international: '한국 출발 국제선' },
  captureModes: { overview: '전체 짐 사진', detail: '개별 물품 사진' },
  photoNotice: '이미 찍어 둔 사진을 보관함·파일에서 선택해 주세요. 사진 선택만으로 분석을 요청하지 않습니다.',
} as const
