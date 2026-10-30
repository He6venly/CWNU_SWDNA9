import { assertEvaluationItems, EvaluateRequestSchema, EvaluateResponseSchema } from '../../../../contract/v2/schemas.ts'
import type { EvaluateRequest, FieldKey, ItemInfo, ItemResult } from '../../../../contract/v2/types.ts'
import { labels } from '../../../../contract/v2/labels.ts'
import { CONTRACT_VERSION } from '../../../../contract/v2/constants.ts'
import { koreanAirRules as rules, rulesCurrent } from './korean-air.ts'

type Verdict = ItemResult['cabin']['verdict']
type Detail = ItemResult['cabin']
type Energy = { value?: number; derived: ItemResult['derivedFields']; issue?: string }
const detail = (verdict: Verdict, reason: string): Detail => ({ verdict, reason })
const need = (reason: string) => detail('NEEDS_INFO', reason)
const prohibited = (reason: string) => detail('PROHIBITED', reason)
const conditional = (reason: string) => detail('CONDITIONAL', reason)

export function deriveAction(cabin: Verdict, checked: Verdict): ItemResult['action'] {
  if (cabin === 'ALLOWED') return 'PUT_IN_CABIN'
  if (checked === 'ALLOWED') return 'PUT_IN_CHECKED'
  if (cabin === 'PROHIBITED' && checked === 'PROHIBITED') return 'LEAVE_BEHIND'
  return 'CHECK_CONDITIONS'
}
function trusted(item: ItemInfo, field: FieldKey) {
  return item.fields[field] !== null && item.fieldSources[field]?.confirmed === true
}
export function resolveEnergy(item: ItemInfo): Energy {
  const direct = trusted(item, 'wh') && item.fieldSources.wh?.source !== 'calculated' ? item.fields.wh! : undefined
  const calculated = trusted(item, 'mah') && trusted(item, 'volts') && item.fieldSources.volts?.voltageType === 'nominal'
    ? item.fields.mah! * item.fields.volts! / 1000 : undefined
  if (direct !== undefined && calculated !== undefined && Math.abs(direct - calculated) > Number.EPSILON * Math.max(direct, calculated) * 4) {
    return { derived: {}, issue: '표시 Wh와 mAh·공칭 전압 계산값이 다릅니다. 같은 배터리의 정격 정보인지 확인해 주세요.' }
  }
  if (direct !== undefined) return { value: direct, derived: {} }
  if (calculated !== undefined) return { value: calculated, derived: { wh: { value: calculated, displayValue: Math.round(calculated * 100) / 100, basis: 'mah*volts/1000', source: 'calculated' } } }
  return { derived: {}, issue: '확인된 Wh 또는 mAh와 배터리 공칭 전압이 필요합니다. 출력 전압·미확인 조회값으로 계산하지 않습니다.' }
}
function safety(item: ItemInfo): Detail | undefined {
  const info = item.details
  if (!info || !('damaged' in info)) return
  if (info.damaged === true) return prohibited('배터리 손상·팽창·과열 위험 징후가 있는 현재 상태로 운송하지 마세요.')
  if (info.recalled !== false) return need('미조치 리콜 여부와 해당 모델의 운송 제한을 확인해 주세요.')
  if (info.damaged !== false) return need('배터리 손상·팽창·과열 징후가 없는지 확인해 주세요.')
}
function finish(item: ItemInfo, cabin: Detail, checked: Detail, missingFields: FieldKey[] = [], derivedFields: ItemResult['derivedFields'] = {}, quantityIssue = false): ItemResult {
  return {
    itemId: item.id, cabin, checked, missingFields, derivedFields, isDemo: false,
    action: quantityIssue ? 'CHECK_CONDITIONS' : deriveAction(cabin.verdict, checked.verdict),
    staffSummary: `${item.name} / 여행자 1명 기준 / 기내: ${labels.verdicts[cabin.verdict]} / 위탁: ${labels.verdicts[checked.verdict]}${quantityIssue ? ' / 현재 목록의 합산 한도 초과. 수량 조정 후 재판정 필요' : ''} / 제공·확인된 정보와 ${rules.version} 기준의 참고 결과. 최종 운송 판단은 항공사·보안검색 직원에게 확인.`,
  }
}
function both(item: ItemInfo, value: Detail) { return finish(item, value, value) }
function ready(item: ItemInfo) { return item.confirmed && item.details?.confirmed === true }
function count(items: ItemInfo[], predicate: (item: ItemInfo) => boolean) {
  return items.filter(item => ready(item) && predicate(item) && trusted(item, 'count')).reduce((sum, item) => sum + item.fields.count!, 0)
}
function volume(items: ItemInfo[], predicate: (item: ItemInfo) => boolean) {
  return items.filter(item => ready(item) && predicate(item) && trusted(item, 'count') && trusted(item, 'ml')).reduce((sum, item) => sum + item.fields.count! * item.fields.ml!, 0)
}
function liquid(input: EvaluateRequest, item: ItemInfo): ItemResult {
  const info = item.details
  if (info?.type !== 'liquid') return both(item, need('액체 종류를 확인해 주세요.'))
  if (info.liquidType === 'hazardous') return both(item, prohibited('발화성·인화성·부식성 등 위험 액체는 휴대·위탁하지 마세요. 예외 가능 품목은 별도 확인이 필요합니다.'))
  if (!info.liquidType || info.liquidType === 'other') return both(item, need('물·비알코올 음료, 개인용 화장품, 주류, 에탄올 손소독제 중 종류를 확인해 주세요. 의약품·면세품·기타 화학제품은 별도 확인 대상입니다.'))
  if (info.liquidType === 'alcohol' && info.alcoholPercent !== null && info.alcoholPercent > rules.liquid.alcoholHighPercent) return both(item, prohibited('70도를 초과하는 주류는 휴대·위탁할 수 없습니다.'))
  const missing: FieldKey[] = (['ml', 'count'] as const).filter(field => !trusted(item, field))
  if (missing.length) {
    const oversized = trusted(item, 'ml') && (input.flightType === 'international' && item.fields.ml! > rules.liquid.internationalContainerMl || info.liquidType === 'ethanol-sanitizer' && item.fields.ml! > rules.liquid.sanitizerContainerMl)
    const oversizedToiletry = trusted(item, 'ml') && item.fields.ml! > rules.liquid.toiletryContainerMl && info.liquidType === 'toiletry'
    return finish(item, oversized || oversizedToiletry && input.flightType === 'domestic' ? prohibited('용기 표시 용량이 기내 휴대 제한을 초과합니다.') : need('내용물 잔량이 아닌 용기 표시 용량(mL)과 수량을 확인해 주세요.'), oversizedToiletry ? prohibited('개인용 화장품·향수·헤어스프레이 용기는 500mL 이하여야 합니다.') : need('용기 용량(mL)과 수량을 확인해 주세요.'), missing)
  }
  const ml = item.fields.ml!, type = info.liquidType, limits = rules.liquid
  let cabin = input.flightType === 'international'
    ? ml > limits.internationalContainerMl ? prohibited('일반 액체의 국제선 기내 휴대 용기는 100mL 이하여야 합니다. 면세품·의약품 예외는 별도 확인 대상입니다.') : conditional('개별 용기 100mL 이하. 여행자 1명당 1L 투명 지퍼백 1개에 모두 넣어 밀봉해야 합니다.')
    : detail('ALLOWED', '해당 한국 국내선 액체에 국제선 100mL 제한을 일괄 적용하지 않습니다. 품목별 용량·포장 조건과 수하물 규격은 별도 확인해 주세요.')
  let checked = conditional('내용물 누출·파손을 막아 포장하고 수하물 규격과 목적지 반입·검역 조건을 확인해 주세요.')
  let quantityIssue = false
  const total = (kind: typeof type) => volume(input.items, candidate => candidate.details?.type === 'liquid' && candidate.details.liquidType === kind)
  if (type === 'toiletry') {
    quantityIssue = total(type) > limits.toiletryTotalMl
    const restricted = ml > limits.toiletryContainerMl || quantityIssue
    checked = restricted ? prohibited('현재 구성 불가. 개인용 화장품·향수·헤어스프레이는 용기당 500mL 이하, 여행자 1명 합계 2L 이하로 조정 후 재판정해 주세요.') : conditional('개인용 화장품·향수·헤어스프레이: 용기당 500mL 이하·1명 합계 2L 이하. 분사 밸브 보호·누출 방지 포장 필요.')
    if (input.flightType === 'domestic') cabin = checked
    else if (quantityIssue) cabin = prohibited('현재 구성 불가. 개인용 화장품류의 합산 수량·용량을 줄인 뒤 재판정해 주세요.')
  } else if (type === 'ethanol-sanitizer') {
    quantityIssue = total(type) > limits.sanitizerTotalMl
    checked = quantityIssue ? prohibited('현재 구성 불가. 에탄올 손소독제는 1명 합계 500mL 이하로 조정해 주세요.') : conditional('에탄올 손소독제는 위탁 용기 제한 없이 1명 합계 500mL 이하. 누출 방지 포장 필요.')
    cabin = quantityIssue ? prohibited('현재 구성 불가. 에탄올 손소독제는 1명 합계 500mL 이하로 조정해 주세요.') : ml > limits.sanitizerContainerMl ? prohibited('국내·국제선 모두 에탄올 손소독제 기내 휴대 용기는 100mL 이하여야 합니다.') : conditional('에탄올 손소독제: 용기당 100mL 이하·1명 합계 500mL 이하. 국제선은 1L 투명 지퍼백 조건도 확인해 주세요.')
  } else if (type === 'alcohol') {
    const percent = info.alcoholPercent
    if (percent === null || percent === limits.alcoholLowPercent || percent === limits.alcoholHighPercent) {
      const explanation = percent === null ? '주류 도수가 필요합니다.' : '24도·70도 경계의 공식 안내가 일치하지 않아 자동 확정하지 않습니다. 대한항공에 확인해 주세요.'
      return finish(item, cabin.verdict === 'PROHIBITED' ? cabin : need(explanation), need(explanation))
    }
    if (percent > limits.alcoholHighPercent) return both(item, prohibited('70도를 초과하는 주류는 휴대·위탁할 수 없습니다.'))
    if (percent > limits.alcoholLowPercent) {
      const alcoholTotal = volume(input.items, candidate => candidate.details?.type === 'liquid' && candidate.details.liquidType === 'alcohol' && candidate.details.alcoholPercent !== null && candidate.details.alcoholPercent > limits.alcoholLowPercent)
      quantityIssue = alcoholTotal > limits.alcoholTotalMl
      checked = quantityIssue ? prohibited('현재 구성 불가. 해당 도수 주류 합계를 1명당 5L 이하로 조정해 주세요.') : conditional('24도 초과·70도 미만 주류는 1명당 합계 5L 이하. 누출·파손 방지 포장과 목적지 주류 제한 별도 확인 필요.')
      if (input.flightType === 'domestic' || quantityIssue) cabin = checked
    }
  }
  const incomplete = !input.inventoryComplete ? ' 부분 목록이므로 다른 물품을 포함한 개인 합산 한도는 별도 확인해야 합니다.' : ''
  if (incomplete) {
    if (cabin.verdict === 'ALLOWED') cabin = conditional(cabin.reason)
    if (cabin.verdict === 'CONDITIONAL') cabin = conditional(cabin.reason + incomplete)
    if (checked.verdict === 'CONDITIONAL') checked = conditional(checked.reason + incomplete)
  }
  return finish(item, cabin, checked, [], {}, quantityIssue)
}
function evaluateItem(input: EvaluateRequest, item: ItemInfo): ItemResult {
  if (!ready(item)) return both(item, need('물품 종류·제품 정보와 추가 안전 정보를 사용자가 확인해야 합니다. 사진 추정·미확인 조회값만으로 확정하지 않습니다.'))
  const info = item.details!
  const category = item.categoryId
  if (category === 'liquid') return liquid(input, item)
  if (category === 'general-items' && info.type === 'general-items') {
    return info.itemType === 'clothing-book' && info.hasRestrictedParts === false
      ? both(item, detail('ALLOWED', '제한 부품이 없는 일반 의류·책이라는 사용자 확인 기준입니다. 수하물 크기·무게와 목적지 규정은 별도 확인해 주세요.'))
      : both(item, need('일반 분류만으로 허용하지 않습니다. 물품 종류와 배터리·액체·날카로운 부품 등 제한 요소를 확인해 주세요.'))
  }
  if (category === 'lighter' && info.type === 'lighter') {
    const checked = prohibited('라이터·안전성냥·라이터 연료는 위탁수하물에 넣지 마세요.')
    if (['torch', 'plasma', 'fuel'].includes(info.lighterType ?? '')) return both(item, prohibited('토치·플라즈마 라이터와 라이터 연료는 휴대·위탁 불가입니다.'))
    if (!['standard', 'safety-matches'].includes(info.lighterType ?? '')) return finish(item, need('일반 소형 라이터인지 안전성냥인지 확인해 주세요.'), need('종류가 확인되지 않아 위탁 결과를 확정하지 않습니다.'))
    if (!trusted(item, 'count')) return finish(item, need('여행자 1명 기준 수량을 확인해 주세요.'), checked, ['count'])
    const quantityIssue = count(input.items, candidate => candidate.details?.type === 'lighter' && ['standard', 'safety-matches'].includes(candidate.details.lighterType ?? '')) > rules.lighterCount
    return finish(item, quantityIssue ? prohibited('현재 구성 불가. 일반 라이터·안전성냥 합계를 1명당 1개로 줄이고 재판정해 주세요.') : conditional('1명당 1개 이하. 일반 라이터는 가방에 넣지 말고 몸에 소지해야 합니다. 다른 라이터·성냥과 합산 여부를 확인해 주세요.'), checked, [], {}, quantityIssue)
  }
  if (category === 'cordless-iron' && info.type === 'cordless-iron') {
    if (info.powerSource === 'mains' && (info.damaged === true || info.recalled === true)) return both(item, need('유선 전용과 배터리 손상·미조치 리콜 정보가 함께 입력되었습니다. 제품 정보를 다시 확인해 주세요.'))
    if (info.powerSource === 'mains') return both(item, conditional('배터리·가스가 없는 유선 제품인지 확인하고 전원을 분리·포장해 주세요. 수하물 크기·무게와 공항 기준은 별도 확인 대상입니다.'))
    if (info.powerSource !== 'lithium-ion-battery') return both(item, need('가스식·기타 전원 제품은 별도 규정 확인이 필요합니다. 충전식 리튬이온 제품이면 전원 방식과 물리적 차단 여부를 입력해 주세요.'))
    const danger = safety(item)
    if (danger?.verdict === 'PROHIBITED') return both(item, danger)
    const checked = prohibited('리튬배터리 무선 고데기는 위탁할 수 없습니다.')
    if (info.isolation === 'none' || info.isolation === 'software-lock') return both(item, prohibited('배터리 분리·물리적 연결 차단이 없는 일체형 발열기기는 운송 불가입니다. 버튼·잠금식 비행기 모드는 물리적 차단으로 인정하지 않습니다.'))
    if (!info.isolation) return finish(item, need('배터리 분리 또는 물리적 퓨즈 차단 기능을 확인해 주세요.'), checked)
    if (danger) return finish(item, danger, checked)
    const energy = resolveEnergy(item)
    if (energy.value === undefined) return finish(item, need(energy.issue!), checked, ['wh'])
    if (energy.value > rules.battery.maximumWh) return finish(item, prohibited('160Wh 초과 배터리 제품은 운송 불가입니다.'), checked, [], energy.derived)
    return finish(item, conditional('배터리 분리형 또는 물리적 퓨즈 차단 제품은 항공사 승인 후 기내 휴대만 가능합니다. 분리·차단 방법과 단락 방지 조치를 확인해 주세요.'), checked, [], energy.derived)
  }
  if (category === 'power-bank' && info.type === 'power-bank' || category === 'electronics' && info.type === 'electronics') {
    const powerBank = info.type === 'power-bank'
    if (!powerBank && info.deviceType !== 'portable-electronic') return both(item, need('발열·이동장치·의료기기·기타 전자장비는 일반 휴대 전자기기로 판정하지 않습니다. 종류별 확인이 필요합니다.'))
    if (!powerBank && info.batteryType === 'none' && (info.damaged === true || info.recalled === true)) return both(item, need('배터리 없음과 손상·미조치 리콜 정보가 함께 입력되었습니다. 제품 정보를 다시 확인해 주세요.'))
    if (!powerBank && info.batteryType === 'none') return both(item, conditional('배터리가 없는 일반 휴대 전자기기 기준입니다. 파손 방지·수하물 규격과 다른 위험 요소를 확인해 주세요.'))
    if (info.batteryType !== 'lithium-ion') return both(item, need('현재 용량 알고리즘은 충전식 리튬이온 제품용입니다. 배터리 종류·리튬 함량 등 별도 정보가 필요합니다.'))
    const checked = powerBank ? prohibited('보조배터리는 용량과 관계없이 위탁 금지입니다.') : conditional('기기 전원을 완전히 끄고 우발 작동·손상 방지 포장 및 항공사 승인 조건을 확인해 주세요. 귀중품은 직접 휴대를 권장합니다.')
    const danger = safety(item)
    if (danger) return danger.verdict === 'PROHIBITED' ? both(item, danger) : finish(item, danger, powerBank ? checked : danger)
    const energy = resolveEnergy(item)
    if (energy.value !== undefined && energy.value > rules.battery.maximumWh) return finish(item, prohibited('160Wh 초과 배터리는 운송 불가입니다.'), prohibited('160Wh 초과 배터리는 위탁할 수 없습니다.'), [], energy.derived)
    const missing: FieldKey[] = [...(energy.value === undefined ? ['wh' as const] : []), ...(!trusted(item, 'count') ? ['count' as const] : [])]
    if (missing.length) return finish(item, need(energy.issue ?? '수량을 확인해 주세요.'), powerBank ? checked : need(energy.issue ?? '수량을 확인해 주세요.'), missing, energy.derived)
    const total = count(input.items, candidate => candidate.categoryId === category && (powerBank || candidate.details?.type === 'electronics' && candidate.details.batteryType === 'lithium-ion'))
    const quantityIssue = powerBank && total > rules.battery.powerBankCount
    const aboveApproval = energy.value! > rules.battery.approvalAboveWh
    let reason = powerBank
      ? '보조배터리 합계 1명당 2개 이하. 단자 절연·개별 보호, 직접 소지 또는 앞 좌석 주머니 보관. 선반 보관과 기내 사용·충전 금지.'
      : '휴대 전자기기는 1명당 15개 이하. 손상·우발 작동을 방지하고 항공사 지침을 확인해 주세요.'
    if (aboveApproval || !powerBank && total > rules.battery.electronicDeviceCount) reason += ' 항공사 사전 승인이 필요합니다.'
    if (aboveApproval && powerBank) reason += ' 100Wh 초과 교체용 배터리를 함께 소지하면 합산 2개 한도도 확인해 주세요.'
    if (!input.inventoryComplete) reason += ' 부분 목록이므로 나머지 짐과 개인 합산 한도를 확인해 주세요.'
    const cabin = quantityIssue ? prohibited('현재 구성 불가. 보조배터리 목록 합계가 1명당 2개를 초과합니다. 선택 수량을 줄인 후 재판정해 주세요.') : conditional(reason)
    const finalChecked = !powerBank && (aboveApproval || total > rules.battery.electronicDeviceCount) ? conditional(checked.reason + ' 100Wh 초과 또는 총 15개 초과 기기는 항공사 승인이 필요합니다.') : checked
    return finish(item, cabin, finalChecked, [], energy.derived, quantityIssue)
  }
  return both(item, need('지원 분류와 추가 제품 정보를 확인해 주세요.'))
}
export function evaluateKoreanAir(value: EvaluateRequest, now = new Date()) {
  const input = EvaluateRequestSchema.parse(value)
  assertEvaluationItems(input.items)
  if (input.airlineId !== rules.airlineId) throw new Error('unsupported airline')
  const current = rulesCurrent(now)
  return EvaluateResponseSchema.parse({
    airlineId: input.airlineId, flightType: input.flightType, departureCountry: input.departureCountry,
    ruleVersion: current ? rules.version : null,
    results: input.items.map(item => current ? evaluateItem(input, item) : both(item, need('규정 검수 유효기간 밖입니다. 공식 규정을 다시 확인하기 전에는 자동 판정하지 않습니다.'))),
    meta: { contractVersion: CONTRACT_VERSION, isDemoRules: false, isDemoRecognition: true, isDemoLookup: true },
  })
}
