import { z } from 'zod'

const confirmation = { confirmed: z.boolean() }
const condition = { damaged: z.boolean().nullable(), recalled: z.boolean().nullable() }
export const detailSchemas = {
  'power-bank': z.strictObject({ ...confirmation, type: z.literal('power-bank'), ...condition,
    batteryType: z.enum(['lithium-ion', 'other']).nullable() }),
  'cordless-iron': z.strictObject({ ...confirmation, type: z.literal('cordless-iron'), ...condition,
    powerSource: z.enum(['lithium-ion-battery', 'mains', 'gas', 'other']).nullable(),
    isolation: z.enum(['removable', 'physical-cutoff', 'software-lock', 'none']).nullable() }),
  liquid: z.strictObject({ ...confirmation, type: z.literal('liquid'),
    liquidType: z.enum(['water-drink', 'toiletry', 'alcohol', 'ethanol-sanitizer', 'hazardous', 'other']).nullable(),
    alcoholPercent: z.number().min(0).max(100).nullable() }),
  lighter: z.strictObject({ ...confirmation, type: z.literal('lighter'),
    lighterType: z.enum(['standard', 'safety-matches', 'torch', 'plasma', 'fuel', 'other']).nullable() }),
  electronics: z.strictObject({ ...confirmation, type: z.literal('electronics'), ...condition,
    deviceType: z.enum(['portable-electronic', 'heating', 'mobility', 'other']).nullable(),
    batteryType: z.enum(['lithium-ion', 'lithium-metal', 'none', 'other']).nullable() }),
  'general-items': z.strictObject({ ...confirmation, type: z.literal('general-items'),
    itemType: z.enum(['clothing-book', 'other']).nullable(), hasRestrictedParts: z.boolean().nullable() }),
} as const
export const ItemDetailsSchema = z.discriminatedUnion('type', [detailSchemas['power-bank'], detailSchemas['cordless-iron'], detailSchemas.liquid, detailSchemas.lighter, detailSchemas.electronics, detailSchemas['general-items']])
export type ItemDetails = z.infer<typeof ItemDetailsSchema>

// 새 정보는 사용자 확인 단계의 입력. AI가 사진만 보고 안전 상태·재질을 확정하지 않음.
export function emptyDetails(type: ItemDetails['type']): ItemDetails {
  const state = { confirmed: false, damaged: null, recalled: null }
  switch (type) {
    case 'power-bank': return { ...state, type, batteryType: null }
    case 'cordless-iron': return { ...state, type, powerSource: null, isolation: null }
    case 'liquid': return { type, confirmed: false, liquidType: null, alcoholPercent: null }
    case 'lighter': return { type, confirmed: false, lighterType: null }
    case 'electronics': return { ...state, type, deviceType: null, batteryType: null }
    case 'general-items': return { type, confirmed: false, itemType: null, hasRestrictedParts: null }
  }
}
export const detailLabels = {
  damaged: '배터리 손상·팽창·과열 징후', recalled: '미조치 리콜 대상', batteryType: '배터리 종류',
  powerSource: '전원 방식', isolation: '배터리 분리·연결 차단 방식', liquidType: '액체 종류',
  alcoholPercent: '주류 알코올 도수(%)', lighterType: '라이터·성냥 종류', deviceType: '전자기기 종류',
  itemType: '일반 물품 종류', hasRestrictedParts: '배터리·액체·날카로운 부품 등 제한 요소 포함',
} as const
export const detailOptionLabels: Record<string, string> = {
  'lithium-ion': '충전식 리튬이온', 'lithium-metal': '리튬메탈', none: '없음', other: '기타·별도 확인',
  'lithium-ion-battery': '충전식 리튬이온 배터리', mains: '배터리·가스 없는 유선 전용', gas: '가스', removable: '배터리 분리 가능',
  'physical-cutoff': '물리적 연결 차단(퓨즈)', 'software-lock': '버튼·잠금·소프트웨어 비행기 모드',
  'water-drink': '물·비알코올 음료', toiletry: '개인용 화장품·향수·헤어스프레이', alcohol: '주류',
  'ethanol-sanitizer': '에탄올 손소독제', hazardous: '발화성·인화성·부식성 등 위험물',
  standard: '일반 소형 라이터', 'safety-matches': '안전성냥', torch: '토치라이터', plasma: '플라즈마 라이터', fuel: '라이터 연료',
  'portable-electronic': '휴대폰·노트북·카메라 등 휴대 전자기기', heating: '발열기기', mobility: '전동 이동장치·휠체어',
  'clothing-book': '일반 의류·책',
}
