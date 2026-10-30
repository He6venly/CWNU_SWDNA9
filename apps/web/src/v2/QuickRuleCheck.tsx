import { useEffect, useMemo, useRef, useState } from 'react'
import type { Airline, FlightType, RulesResponse } from '../../../../contract/v2/types.ts'
import { LIMITS } from '../../../../contract/v2/constants.ts'
import UiIcon from '../../../check/src/UiIcon.tsx'
import AirlineOptions from './AirlineOptions.tsx'
import { quickItemCatalog, searchQuickItems, type QuickCategory, type QuickItem } from './quickItemCatalog.ts'
import { prepareImage } from './image.ts'
import { api } from './api.ts'
import { quickItemIcon } from './quickItemIcons.ts'

const categoryLabels: Record<QuickCategory, string> = {
  'power-bank': '배터리',
  'cordless-iron': '발열 기기',
  liquid: '액체·젤류',
  lighter: '점화 용품',
  electronics: '전자기기',
  'general-items': '일반 소지품',
}

function guidance(item: QuickItem, flightType: FlightType, limits: RulesResponse['ruleLimits']) {
  const international = flightType === 'international'
  const base = item.guidance ?? {
    'power-bank': { cabin: '조건 확인 후 기내', checked: '위탁 불가', action: 'Wh·수량·손상 여부를 확인하고 단자를 절연하세요.' },
    'cordless-iron': { cabin: '제품 방식 확인 필요', checked: '배터리형 위탁 불가', action: '유선·가스·배터리 방식과 분리·물리 차단 가능 여부를 확인하세요.' },
    liquid: { cabin: international ? '100mL 이하 조건' : '품목별 조건 확인', checked: '종류·용량 확인', action: international ? '용기당 100mL 이하, 1L 투명 지퍼백 조건을 확인하세요.' : '액체 종류·용기 용량·누출 방지 조건을 확인하세요.' },
    lighter: { cabin: '종류 확인 후 1개', checked: '위탁 불가', action: '일반 소형 라이터·안전성냥인지 확인하세요. 토치·플라즈마·연료는 제한됩니다.' },
    electronics: { cabin: '조건 확인 후 가능', checked: '조건 확인 후 가능', action: '배터리 종류·Wh·손상 여부를 확인하고 전원과 오작동을 차단하세요.' },
    'general-items': { cabin: '제한 요소 없으면 가능', checked: '제한 요소 없으면 가능', action: '배터리·액체·날카로운 부품·위험물이 포함되었는지 확인하세요.' },
  }[item.category]
  const battery = limits.battery
  const batteryRange = battery.approvalAboveWh < battery.powerBankMaximumWh
    ? `${battery.approvalAboveWh}Wh 이하 가능 · 초과~${battery.powerBankMaximumWh}Wh 승인 필요`
    : `${battery.powerBankMaximumWh}Wh 이하 가능 · 초과 불가`
  if (item.category === 'power-bank' && item.id === 'power-bank') return {
    ...base,
    cabin: batteryRange,
    action: `${base.action} 보조배터리는 1명당 ${battery.powerBankCount}개 이하이며 ${battery.powerBankMaximumWh}Wh를 초과할 수 없습니다.`,
  }
  if (item.category === 'power-bank') return {
    ...base,
    cabin: item.guidance?.cabin ?? batteryRange,
    action: `${base.action} 리튬 배터리는 ${battery.approvalAboveWh}Wh 초과 시 승인, ${battery.deviceMaximumWh}Wh 초과 시 반입 불가입니다.`,
  }
  if (item.category === 'electronics') return {
    ...base,
    cabin: item.guidance?.cabin ?? `${battery.approvalAboveWh}Wh 이하 가능 · 초과~${battery.deviceMaximumWh}Wh 승인 필요`,
    action: `${base.action} 배터리는 ${battery.approvalAboveWh}Wh 초과 시 승인, ${battery.deviceMaximumWh}Wh 초과 시 반입 불가이며 휴대 전자기기는 1명당 ${battery.electronicDeviceCount}개 이하입니다.`,
  }
  if (item.category === 'liquid' && international) return {
    ...base,
    cabin: item.guidance?.cabin ?? `용기당 ${limits.liquid.internationalContainerMl}mL 이하`,
    action: `${base.action} 국제선 기내 용기는 각각 ${limits.liquid.internationalContainerMl}mL 이하여야 합니다.`,
  }
  if (item.category === 'lighter' && ['lighter', 'safety-matches'].includes(item.id)) return {
    ...base,
    cabin: limits.lighterCount > 0 ? `1명당 ${limits.lighterCount}개 기내 휴대` : '기내 반입 불가',
    action: limits.lighterCount > 0 ? `${base.action} 1명당 ${limits.lighterCount}개까지만 허용됩니다.` : '선택한 항공사는 라이터·성냥의 기내 및 위탁 반입을 허용하지 않습니다.',
  }
  return base
}

type Props = {
  airlines: Airline[]
  flightType: FlightType
  originCountry: string
  foreignDeparture: boolean
  initialAirlineId?: string
  onUseItem?: (item: QuickItem) => void
  useItemDisabled?: boolean
  title?: string
  eyebrow?: string
}

export default function QuickRuleCheck({ airlines, flightType, originCountry, foreignDeparture, initialAirlineId = '', onUseItem, useItemDisabled = false, title = '급할 때 빠른 규정 확인', eyebrow = '30-SECOND CHECK' }: Props) {
  const [query, setQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<QuickItem | null>(null)
  const [airlineId, setAirlineId] = useState(initialAirlineId)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')
  const [ruleInfo, setRuleInfo] = useState<RulesResponse | null>(null)
  const [ruleMessage, setRuleMessage] = useState('')
  const photoInput = useRef<HTMLInputElement | null>(null)
  const photoRequest = useRef<AbortController | null>(null)
  const results = useMemo(() => searchQuickItems(query).slice(0, 8), [query])
  const selectedAirline = airlines.find((airline) => airline.id === airlineId)
  const result = selectedItem && ruleInfo?.airlineId === airlineId ? guidance(selectedItem, flightType, ruleInfo.ruleLimits) : null
  const searching = Boolean(query.trim()) && !selectedItem

  useEffect(() => () => { photoRequest.current?.abort(); photoRequest.current = null }, [])

  useEffect(() => {
    if (!airlineId) return
    const controller = new AbortController()
    void api.rules(airlineId, controller.signal).then((response) => {
      setRuleInfo(response)
      setRuleMessage(response.current ? '' : '규정 검수 기한이 만료되어 최신 기준 확인이 필요합니다.')
    }).catch((error) => {
      if (!controller.signal.aborted) setRuleMessage(error instanceof Error ? error.message : '항공사 규정을 불러오지 못했습니다.')
    })
    return () => controller.abort()
  }, [airlineId])

  function cancelPhoto() {
    photoRequest.current?.abort()
    photoRequest.current = null
    setPhotoBusy(false)
  }

  function chooseItem(item: QuickItem) {
    setSelectedItem(item)
    setQuery(item.name)
    setAirlineId(initialAirlineId)
  }

  function resetItem() {
    cancelPhoto()
    setSelectedItem(null)
    setQuery('')
    setAirlineId('')
    setRuleInfo(null)
    setRuleMessage('')
  }

  async function analyzePhoto(file: File) {
    photoRequest.current?.abort()
    const controller = new AbortController()
    photoRequest.current = controller
    setPhotoBusy(true)
    setPhotoMessage('사진을 준비하고 물품을 인식하는 중입니다…')
    let preview = ''
    try {
      const prepared = await prepareImage(file, controller.signal, LIMITS.clientImageBytes, 'closeup')
      preview = prepared.preview
      const response = await api.recognize({ captureMode: 'detail', mode: 'estimate', images: [{ id: `quick-${crypto.randomUUID()}`, kind: 'closeup', ...prepared.image, cropped: prepared.cropApplied }] }, controller.signal)
      const recognized = response.items[0]
      if (!recognized) {
        setPhotoMessage('물품을 인식하지 못했습니다. 다른 각도의 사진이나 품목명 검색을 사용해 주세요.')
        return
      }
      const category = recognized.categoryId ?? 'general-items'
      const matched = searchQuickItems(recognized.name)[0]
      chooseItem(matched ?? { id: `recognized-${crypto.randomUUID()}`, name: recognized.name, category, aliases: [], description: 'AI 사진 인식 결과 · 품목 확인 필요' })
      setPhotoMessage(`${recognized.name}(으)로 인식했습니다.${response.multipleItemsDetected ? ' 여러 물품 중 첫 번째 결과입니다.' : ''} 품목을 확인하고 항공사를 선택해 주세요.${response.meta.isDemoRecognition ? ' 현재 인식은 시연 결과입니다.' : ''}`)
    } catch (error) {
      if (!controller.signal.aborted) setPhotoMessage(error instanceof Error ? error.message : '사진을 분석하지 못했습니다.')
    } finally {
      if (preview) URL.revokeObjectURL(preview)
      if (photoRequest.current === controller) {
        photoRequest.current = null
        setPhotoBusy(false)
      }
    }
  }

  return (
    <section className={`quick-rule-check${searching ? ' is-searching' : ''}${selectedItem ? ' has-selection' : ''}`}>
      <div className="quick-rule-heading">
        <div className="section-heading-title"><UiIcon name="quick" /><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>
        <span>현재 여행 노선 · {flightType === 'domestic' ? '한국 국내선' : `${originCountry} 출발 국제선`}</span>
      </div>

      <div className="quick-search-bar">
        <UiIcon name="search" compact />
        <input value={query} onChange={(event) => { cancelPhoto(); setPhotoMessage(''); setQuery(event.target.value); setSelectedItem(null); setAirlineId('') }} placeholder="품목 검색 · 예: 보조배터리, 가위, 향수" aria-label="빠른 규정 확인 품목 검색" />
        {query && <button className="quick-search-clear" type="button" aria-label="검색어 지우기" onClick={resetItem}>×</button>}
        <input ref={photoInput} className="quick-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="빠른 확인용 물품 사진 선택" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void analyzePhoto(file) }} />
        <button className="quick-photo-button" type="button" disabled={photoBusy} onClick={() => photoInput.current?.click()} aria-label="사진으로 물품 찾기"><UiIcon name="photo" compact /><span className="quick-photo-label">{photoBusy ? '분석 중' : '사진'}</span></button>
      </div>

      {photoMessage && <p className="quick-photo-status" role="status">{photoMessage}</p>}

      {searching && <SearchResults query={query} results={results} onChoose={chooseItem} />}

      {!searching && !selectedItem && <div className="quick-rule-start">
        <p>품목명을 입력하면 바로 검색됩니다. 사진 1장으로 AI 인식 후 항공사를 선택할 수도 있습니다.</p>
        <div className="quick-popular-items" aria-label="자주 찾는 품목">
          {['power-bank', 'curling-iron', 'perfume', 'laptop', 'scissors', 'medication'].map((id) => {
            const item = quickItemCatalog.find((entry) => entry.id === id)!
            return <button key={item.id} type="button" onClick={() => chooseItem(item)}>{item.name}</button>
          })}
        </div>
      </div>}

      {selectedItem && <div className="quick-airline-step">
        <div className="quick-selected-item"><ItemIcon item={selectedItem} /><span className="quick-selected-copy"><small>선택한 품목</small><strong>{selectedItem.name}</strong><em>{selectedItem.description}</em></span><button type="button" className="text-button" onClick={resetItem}>다시 검색</button></div>
        <label>이용 항공사<select value={airlineId} onChange={(event) => { setAirlineId(event.target.value); setRuleInfo(null); setRuleMessage('') }}><option value="">항공사 선택</option><AirlineOptions airlines={airlines} flightType={flightType} /></select></label>
      </div>}

      {selectedItem && selectedAirline && (ruleMessage || !result) && <p className="quick-photo-status" role="status">{ruleMessage || '항공사 규정을 불러오는 중입니다…'}</p>}

      {selectedItem && selectedAirline && result && <div className="quick-rule-result" aria-live="polite">
        <header className="quick-result-title"><ItemIcon item={selectedItem} /><span className="quick-result-copy"><strong>{selectedItem.name}</strong><small>{selectedAirline.name} · {categoryLabels[selectedItem.category]}</small></span></header>
        <div><span><small>기내</small><b>{result.cabin}</b></span><span><small>위탁</small><b>{result.checked}</b></span></div>
        <p>{result.action}</p>
        <small>{foreignDeparture ? '해외 출발은 현지 공항·항공사 규정을 추가 확인해야 합니다. ' : ''}선택 항공사의 검수 규정 수치를 반영한 예비 안내입니다. 정확한 판정은 물품 등록에서 상세 정보를 확인해 주세요.</small>
        {onUseItem && <button className="primary-action quick-use-action" type="button" disabled={useItemDisabled} onClick={() => onUseItem(selectedItem)}>{useItemDisabled ? '등록 가능한 물품 수 초과' : '이 품목을 등록 목록에 추가'}</button>}
      </div>}
    </section>
  )
}

function SearchResults({ query, results, onChoose }: { query: string; results: QuickItem[]; onChoose: (item: QuickItem) => void }) {
  return <div className="quick-search-results" aria-live="polite">
    <p><strong>{results.length}개</strong> 검색 결과</p>
    {results.length ? results.map((item) => <button type="button" key={item.id} onClick={() => onChoose(item)}>
      <ItemIcon item={item} />
      <span className="quick-search-copy"><strong>{item.name}</strong><small>{item.aliases.slice(0, 3).join(' · ')} · {categoryLabels[item.category]}</small></span>
      <b aria-hidden="true">›</b>
    </button>) : <div className="quick-search-empty"><strong>‘{query}’ 검색 결과가 없습니다.</strong><span>다른 이름으로 검색하거나 사진으로 물품을 확인해 주세요.</span></div>}
  </div>
}

function ItemIcon({ item }: { item: QuickItem }) {
  return <span className={`quick-item-icon quick-item-icon-${item.category}`} aria-hidden="true">{quickItemIcon(item)}</span>
}
