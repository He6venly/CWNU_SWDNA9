import { useMemo, useState } from 'react'
import type { Airline, ItemInfo } from '../../../../contract/v2/types.ts'
import type { TravelRecord } from './travelStore.ts'
import QuickRuleCheck from './QuickRuleCheck.tsx'
import UiIcon from '../../../check/src/UiIcon.tsx'
import AirlineOptions from './AirlineOptions.tsx'
import type { FlightType } from '../../../../contract/v2/types.ts'
import { countryName, isTravelCountry, travelCountries } from './travelCountries.ts'

type Props = {
  current: TravelRecord
  travels: TravelRecord[]
  packedItemIds: string[]
  airlines: Airline[]
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  routeError: string
  onChange: (patch: Partial<TravelRecord>) => void
  onAirlineChange: (airlineId: string) => void
  onFlightTypeChange: (flightType: FlightType) => void
  onTogglePacked: (itemId: string) => void
  onAddItem: () => void
  onOpen: (travel: TravelRecord) => void
  onNew: () => void
}

export default function TravelHome({
  current,
  travels,
  packedItemIds,
  airlines,
  saveState,
  routeError,
  onChange,
  onAirlineChange,
  onFlightTypeChange,
  onTogglePacked,
  onAddItem,
  onOpen,
  onNew,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'unpacked' | 'needs-info'>('all')
  const items = useMemo(
    () =>
      current.items.filter((item) => {
        if (filter === 'unpacked') return !packedItemIds.includes(item.id)
        if (filter === 'needs-info') return !item.confirmed
        return true
      }),
    [current.items, filter, packedItemIds],
  )
  return (
    <div className="screen-stack">
      <section className="trip-summary trip-ticket-summary">
        <div className="trip-brand-panel">
          <p className="eyebrow">CURRENT TRIP</p>
          <h1>이번 여행 준비</h1>
          <p className="brand-description">출발지·항공사·목적지에 맞춰 반입 규정을 확인합니다.</p>
          <p className="trip-id">CURRENT TRIP · {current.id}</p>
        </div>
        <div className="ticket-top-controls">
          <div className={`autosave-status autosave-${saveState}`} role="status"><span aria-hidden="true">{saveState === 'saving' ? '…' : saveState === 'error' ? '!' : '✓'}</span><div><strong>{saveState === 'saving' ? '저장 중' : saveState === 'saved' ? '자동 저장됨' : saveState === 'error' ? '저장 실패' : '자동 저장'}</strong><small>{saveState === 'error' ? '브라우저 저장 기능을 확인해 주세요.' : '여행 경로와 준비 정보를 보존합니다.'}</small></div></div>
          <div className="route-type-switch" role="group" aria-label="노선 선택">
            {([['domestic', '국내선'], ['international', '국제선']] as const).map(([value, label]) => <button key={value} className={current.flightType === value ? 'active' : ''} onClick={() => onFlightTypeChange(value)}>{label}</button>)}
          </div>
        </div>
        <div className="ticket-route-panel">
          <img className="ticket-route-art" src="/ticket-route-blue.png" alt="" aria-hidden="true" />
          <div className="ticket-route-main">
            <div className="route-points">
              <label><span>출발 국가</span><select value={current.origin} onChange={(event) => onChange({ origin: event.target.value })}>{!isTravelCountry(current.origin) && <option value={current.origin}>{current.origin} · 기존 입력</option>}{travelCountries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
              <button className="route-swap" type="button" aria-label="출발 국가와 목적 국가 교환" disabled={!current.destination || current.origin === current.destination} onClick={() => onChange({ origin: current.destination, destination: current.origin })}>⇄</button>
              <label><span>목적 국가</span><select required aria-invalid={Boolean(routeError)} value={current.destination} onChange={(event) => onChange({ destination: event.target.value })}><option value="">나라 선택</option>{current.destination && !isTravelCountry(current.destination) && <option value={current.destination}>{current.destination} · 기존 입력</option>}{travelCountries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
            </div>
          </div>
          <div className="ticket-route-stub">
            <span>BOARDING INFO</span>
            <label className="ticket-airline">항공사<select value={current.airlineId} onChange={(event) => onAirlineChange(event.target.value)}><AirlineOptions airlines={airlines} flightType={current.flightType} /></select></label>
            <label>출발일<input type="date" value={current.date} onChange={(event) => onChange({ date: event.target.value })} /></label>
            <strong>{current.flightType === 'domestic' ? 'DOMESTIC' : 'INTERNATIONAL'}</strong>
          </div>
        </div>
        {routeError && <p className="route-required-notice" role="alert">{routeError}</p>}
        {current.origin !== 'KR' && <p className="return-route-notice">귀국편 등 해외 출발은 현지 공항·항공사 규정이 추가 적용됩니다. 현재 자동 판정은 한국 출발 공통 기준을 참고용으로 제공합니다.</p>}
      </section>

      <QuickRuleCheck key={`${current.flightType}-${current.origin}`} airlines={airlines} flightType={current.flightType} originCountry={countryName(current.origin)} foreignDeparture={current.origin !== 'KR'} />

      <section className="inventory-board">
        <header className="section-heading compact-heading">
          <div className="section-heading-title"><UiIcon name="verify" /><div><p className="eyebrow">PACKING LIST</p><h1>짐 챙김 현황</h1></div></div>
          <button className="primary-action" onClick={onAddItem}>+ 물품 등록</button>
        </header>
        <div className="metric-strip">
          <Metric label="등록" value={current.items.length} />
          <Metric label="챙김" value={packedItemIds.length} />
          <Metric label="정보 확인 필요" value={current.items.filter((item) => !item.confirmed).length} caution />
        </div>
        <div className="filter-row" role="group" aria-label="물품 필터">
          {([['all', '전체'], ['unpacked', '미준비'], ['needs-info', '확인 필요']] as const).map(([value, label]) => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <ItemList items={items} packedItemIds={packedItemIds} onToggle={onTogglePacked} />
      </section>

      {!!travels.length && (
        <section className="saved-trips">
          <div className="section-heading compact-heading"><div className="section-heading-title"><UiIcon name="album" /><div><p className="eyebrow">SAVED TRIPS</p><h2>저장한 여행</h2></div></div><button className="text-button" onClick={onNew}>+ 새 여행</button></div>
          <div className="trip-list">
            {travels.map((travel) => (
              <button key={travel.id} className={travel.id === current.id ? 'trip-row active' : 'trip-row'} onClick={() => onOpen(travel)}>
                <span><strong>{travel.title || (travel.destination ? `${countryName(travel.destination)} 여행` : '여행 준비 기록')}</strong><small>{travel.date || '날짜 미정'} · {travel.destination ? countryName(travel.destination) : '목적지 미정'}</small></span>
                <b>{travel.items.length}개</b>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Metric({ label, value, caution = false }: { label: string; value: number; caution?: boolean }) {
  return <div className={caution ? 'metric caution' : 'metric'}><strong>{value}</strong><span>{label}</span></div>
}

function ItemList({ items, packedItemIds, onToggle }: { items: ItemInfo[]; packedItemIds: string[]; onToggle: (id: string) => void }) {
  if (!items.length) return <div className="empty-state"><strong>등록된 물품이 없습니다.</strong><p>물품 등록에서 사진을 분석하거나 직접 추가해 주세요.</p></div>
  return <ul className="packing-list">{items.map((item) => <li key={item.id}>
    <label><input type="checkbox" checked={packedItemIds.includes(item.id)} onChange={() => onToggle(item.id)} /><span><strong>{item.name || '물품명 미입력'}</strong><small>{item.fields.modelName ?? '모델명 미확인'} · {item.confirmed ? '정보 확인' : '정보 확인 필요'}</small></span></label>
  </li>)}</ul>
}
