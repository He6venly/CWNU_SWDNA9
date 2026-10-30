import type { FlightType } from '../../../../contract/v2/types.ts'
import { LIMITS } from '../../../../contract/v2/constants.ts'
import { createNamedManualItem } from '../../../../contract/v2/manual.ts'
import PhotoSection from './PhotoSection.tsx'
import ItemEditor from './ItemEditorV2.tsx'
import LabelSupplement from './LabelSupplement.tsx'
import LookupCandidates from './LookupCandidates.tsx'
import type { useTravelWorkbench } from './useTravelWorkbench.ts'
import UiIcon from '../../../check/src/UiIcon.tsx'
import AirlineOptions from './AirlineOptions.tsx'
import AssessmentResults from './AssessmentResults.tsx'
import type { TravelRecord } from './travelStore.ts'
import { countryName } from './travelCountries.ts'
import QuickRuleCheck from './QuickRuleCheck.tsx'

type Workbench = ReturnType<typeof useTravelWorkbench>

type Props = {
  workbench: Workbench
  travel: TravelRecord
  onFlightTypeChange: (flightType: FlightType) => void
  onEditTravel: () => void
  onCatalog: () => void
}

export default function ItemRegistration({ workbench, travel, onFlightTypeChange, onEditTravel, onCatalog }: Props) {
  const w = workbench
  const routeReady = Boolean(travel.origin && travel.destination && travel.date && w.airlineId)
  return (
    <div className="screen-stack registration-screen">
      <section className="route-bar">
        <div className="route-title"><UiIcon name="flight" /><div><p className="eyebrow">FLIGHT</p><h1>물품 등록</h1><p>사진은 누적 등록됩니다. 새 사진을 선택해도 기존 물품은 유지됩니다.</p></div></div>
        <label>항공사<select value={w.airlineId} disabled={w.busy} onChange={(event) => { w.invalidate(); w.setAirlineId(event.target.value) }}>
          {w.airlines.length ? <AirlineOptions airlines={w.airlines} flightType={w.flightType} /> : <option value="korean-air" disabled>대한항공 · 조회 중</option>}
        </select></label>
        <label>노선<select value={w.flightType} disabled={w.busy} onChange={(event) => onFlightTypeChange(event.target.value as FlightType)}><option value="domestic">한국 국내선</option><option value="international">한국 출발 국제선</option></select></label>
        <div className={routeReady ? 'registration-route-context' : 'registration-route-context incomplete'}>
          <span><strong>{countryName(travel.origin)} → {travel.destination ? countryName(travel.destination) : '목적지 미정'}</strong> · {travel.date || '출발일 미정'}</span>
          <small>{travel.origin !== 'KR' ? '해외 출발은 한국 출발 기준의 참고 판정입니다.' : '비어 있던 출발국·항공사·출발일만 기본값으로 보완됩니다.'}</small>
          <button className="text-button" type="button" onClick={onEditTravel}>여행 정보 수정</button>
        </div>
      </section>

      <PhotoSection
        photos={w.photos}
        captureMode={w.captureMode}
        mode={w.mode}
        busy={w.busy}
        resetPhotos={w.resetPhotos}
        setCaptureMode={w.setCaptureMode}
        setMode={w.setMode}
        setPhotos={w.setPhotos}
        setPreparing={w.setPreparing}
        message={w.task.setMessage}
        invalidate={w.invalidate}
        analyze={w.analyze}
      />

      <QuickRuleCheck
        airlines={w.airlines}
        flightType={w.flightType}
        originCountry={countryName(travel.origin)}
        foreignDeparture={travel.origin !== 'KR'}
        initialAirlineId={w.airlineId}
        eyebrow="QUICK ADD"
        title="품목 빠른 검색·추가"
        useItemDisabled={w.busy || w.items.length >= LIMITS.maxItems}
        onUseItem={(item) => {
          w.invalidate()
          w.setItems((current) => [...current, createNamedManualItem(item.category, item.name, `manual-${crypto.randomUUID()}`)])
          w.task.setMessage(`${item.name} 입력 항목을 추가했습니다. 아래에서 세부 정보를 확인해 주세요.`)
        }}
      />

      <section className="card-section items-section">
        <div className="section-heading compact-heading"><div className="section-heading-title"><UiIcon name="verify" /><div><p className="eyebrow">VERIFY</p><h2>물품 정보 확인</h2></div></div><span className="item-count">{w.items.length}개</span></div>
        {!w.items.length && <div className="empty-state"><strong>아직 등록된 물품이 없습니다.</strong><p>사진을 분석하거나 빠른 추가를 사용해 주세요.</p></div>}
        {w.items.map((item, index) => <article className="item-card" key={item.id}>
          <span className="item-sequence">ITEM {String(index + 1).padStart(2, '0')}</span>
          <fieldset className="item-lock" disabled={w.saving}>
            <ItemEditor item={item} onChange={(changed) => { w.updateItem(changed); w.task.setMessage('정보가 변경되어 이전 판정을 폐기했습니다.') }} />
            <LabelSupplement item={item} busy={w.busy} onAnalyze={(selected) => w.analyzeLabel(item, selected)} />
            <p className="helper-copy">라벨 값을 우선 확인하세요. 제품 검색은 모델명 확인 후 사양이 부족할 때만 선택적으로 사용합니다.</p>
            <div className="item-card-actions">
              <button type="button" className="secondary-action" disabled={w.busy || !item.fields.modelName} onClick={() => w.lookupItem(item)}>선택: 제품 사양 추가 조회</button>
              <button type="button" className="danger-action" disabled={w.busy} onClick={() => { w.invalidate(); w.setItems((current) => current.filter((entry) => entry.id !== item.id)) }}>이 물품 제외</button>
            </div>
            {w.lookups[item.id] && <LookupCandidates value={w.lookups[item.id]!} disabled={w.busy} onSelect={(candidate) => w.chooseCandidate(item, candidate)} />}
          </fieldset>
        </article>)}
        <label className="completion-check"><input type="checkbox" checked={w.inventoryComplete} disabled={w.busy} onChange={(event) => { w.invalidate(); w.setInventoryComplete(event.target.checked) }} />여행자 1명의 전체 물품 목록입니다.</label>
        <div className="registration-actions">
          <button className="primary-action" disabled={!routeReady || !w.inventoryComplete || w.busy || !w.items.length || w.items.some((item) => !item.confirmed || !item.name.trim()) || !w.airlines.some((airline) => airline.id === w.airlineId && !airline.isDemo && airline.enabled && airline.supportedFlightTypes.includes(w.flightType))} onClick={w.evaluate}>반입 판정 실행 →</button>
        </div>
      </section>
      {!!w.results.length && <AssessmentResults workbench={w} onCatalog={onCatalog} embedded />}
    </div>
  )
}
