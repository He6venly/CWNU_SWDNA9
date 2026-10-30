import type { FlightType, RulesResponse } from '../../../../contract/v2/types.ts'
import type { QuickGuidance, QuickItem } from './quickItemCatalog.ts'

const portableElectronics = new Set([
  'laptop', 'e-cigarette', 'drone', 'bluetooth-earbuds', 'smart-luggage', 'portable-fan', 'electric-toothbrush',
  'electric-shaver', 'game-console', 'smartphone', 'camera', 'bluetooth-speaker', 'robot-vacuum',
])
const toiletries = new Set(['hair-spray', 'perfume', 'sunscreen', 'skincare-liquid', 'insect-repellent', 'shampoo', 'toothpaste'])
const cabinLiquids = new Set([...toiletries, 'alcohol-beverage', 'hand-sanitizer', 'semi-liquid-food', 'cooking-oil'])

export function quickRuleGuidance(item: QuickItem, flightType: FlightType, limits: RulesResponse['ruleLimits']): QuickGuidance {
  const international = flightType === 'international'
  const base = item.guidance ?? {
    'power-bank': { cabin: '조건 확인 후 기내', checked: '위탁 불가', action: 'Wh·수량·손상 여부를 확인하고 단자를 절연하세요.' },
    'cordless-iron': { cabin: '제품 방식 확인 필요', checked: '배터리형 위탁 불가', action: '유선·가스·배터리 방식과 분리·물리 차단 가능 여부를 확인하세요.' },
    liquid: { cabin: international ? '용량 조건 확인' : '품목별 조건 확인', checked: '종류·용량 확인', action: '액체 종류·용기 용량·누출 방지 조건을 확인하세요.' },
    lighter: { cabin: '종류 확인 후 1개', checked: '위탁 불가', action: '일반 소형 라이터·안전성냥인지 확인하세요. 토치·플라즈마·연료는 제한됩니다.' },
    electronics: { cabin: '조건 확인 후 가능', checked: '조건 확인 후 가능', action: '배터리 종류·Wh·손상 여부를 확인하고 전원과 오작동을 차단하세요.' },
    'general-items': { cabin: '제한 요소 없으면 가능', checked: '제한 요소 없으면 가능', action: '배터리·액체·날카로운 부품·위험물이 포함되었는지 확인하세요.' },
  }[item.category]
  const battery = limits.battery
  const powerBankRange = battery.approvalAboveWh < battery.powerBankMaximumWh
    ? `${battery.approvalAboveWh}Wh 이하 · 초과~${battery.powerBankMaximumWh}Wh 승인 필요`
    : `${battery.powerBankMaximumWh}Wh 이하 · 초과 불가`

  if (item.id === 'power-bank') return {
    ...base,
    cabin: powerBankRange,
    action: `${base.action} 보조배터리는 1명당 ${battery.powerBankCount}개 이하이며 ${battery.powerBankMaximumWh}Wh를 초과할 수 없습니다.`,
  }
  if (item.category === 'power-bank') return {
    ...base,
    cabin: `${base.cabin} · 리튬이면 ${battery.approvalAboveWh}/${battery.deviceMaximumWh}Wh 기준`,
    action: `${base.action} 충전식 리튬이온이면 ${battery.approvalAboveWh}Wh 초과 시 승인, ${battery.deviceMaximumWh}Wh 초과 시 반입 불가입니다.`,
  }
  if (portableElectronics.has(item.id)) return {
    ...base,
    cabin: item.guidance?.cabin ?? `${battery.approvalAboveWh}Wh 이하 · 초과~${battery.deviceMaximumWh}Wh 승인 필요`,
    action: `${base.action} 충전식 리튬이온 배터리는 ${battery.deviceMaximumWh}Wh를 초과할 수 없으며 휴대 전자기기는 1명당 ${battery.electronicDeviceCount}개 이하입니다.`,
  }
  if (item.category === 'cordless-iron') return {
    ...base,
    cabin: `배터리형 ${battery.deviceMaximumWh}Wh 이하 · 승인 필요`,
    action: `${base.action} 충전식 제품은 ${battery.deviceMaximumWh}Wh 이하이고 배터리 분리 또는 물리적 전원 차단이 가능해야 합니다.`,
  }
  if (item.id === 'alcohol-beverage') {
    const liquid = limits.liquid
    return {
      ...base,
      cabin: international ? `용기당 ${liquid.internationalContainerMl}mL 이하` : '도수·용량 확인',
      action: `${base.action} ${liquid.alcoholLowPercent}% 이하는 일반 주류 기준, 초과~${liquid.alcoholHighPercent}%는 1명당 총 ${liquid.alcoholTotalMl / 1000}L 이하이며 ${liquid.alcoholHighPercent}% 초과는 반입 불가입니다.`,
    }
  }
  if (item.id === 'hand-sanitizer') return {
    ...base,
    cabin: international ? `용기당 ${limits.liquid.internationalContainerMl}mL 이하` : `용기당 ${limits.liquid.sanitizerContainerMl}mL 이하`,
    action: `${base.action} 에탄올 손소독제는 용기당 ${limits.liquid.sanitizerContainerMl}mL, 1명당 총 ${limits.liquid.sanitizerTotalMl}mL 이하입니다.`,
  }
  if (toiletries.has(item.id)) return {
    ...base,
    cabin: international ? `용기당 ${limits.liquid.internationalContainerMl}mL 이하` : `용기당 ${limits.liquid.toiletryContainerMl}mL 이하`,
    action: `${base.action} 개인용 화장품·향수·스프레이는 용기당 ${limits.liquid.toiletryContainerMl}mL, 1명당 총 ${limits.liquid.toiletryTotalMl}mL 이하입니다.`,
  }
  if (international && cabinLiquids.has(item.id)) return {
    ...base,
    cabin: `용기당 ${limits.liquid.internationalContainerMl}mL 이하`,
    action: `${base.action} 국제선 기내 용기는 각각 ${limits.liquid.internationalContainerMl}mL 이하여야 합니다.`,
  }
  if (item.category === 'lighter' && ['lighter', 'safety-matches'].includes(item.id)) return {
    ...base,
    cabin: limits.lighterCount > 0 ? `1명당 합계 ${limits.lighterCount}개` : '기내 반입 불가',
    action: limits.lighterCount > 0 ? `${base.action} 일반 라이터와 안전성냥을 합쳐 1명당 ${limits.lighterCount}개까지만 허용됩니다.` : '선택한 항공사는 라이터·성냥의 기내 및 위탁 반입을 허용하지 않습니다.',
  }
  return base
}
