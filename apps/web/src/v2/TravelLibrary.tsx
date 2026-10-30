import { useEffect, useMemo, useRef, useState } from 'react'
import type { TravelRecord } from './travelStore.ts'
import Catalog from './Catalog.tsx'
import LegacyCatalog from './LegacyCatalog.tsx'
import TravelAlbum from '../../../check/src/TravelAlbum.tsx'
import type { Airline, ItemInfo } from '../../../../contract/v2/types.ts'
import type { Photo } from './PhotoPicker.tsx'
import UiIcon from '../../../check/src/UiIcon.tsx'
import { countryName } from './travelCountries.ts'

function Cover({ blob, title }: { blob?: Blob; title: string }) {
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    if (ref.current) ref.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return blob ? <img ref={ref} alt={`${title} 여행 표지`} /> : <div className="gallery-placeholder" aria-hidden="true">✈</div>
}

export default function TravelLibrary({ travels, airlines, items, photos, onOpen, onDelete, onRestore, catalogRevision, currentRuleVersion, rulesCurrent }: {
  travels: TravelRecord[]
  airlines: Airline[]
  items: ItemInfo[]
  photos: Photo[]
  onOpen: (travel: TravelRecord) => void
  onDelete: (travel: TravelRecord) => void
  onRestore: (items: ItemInfo[]) => void
  catalogRevision: number
  currentRuleVersion: string | null
  rulesCurrent: boolean
}) {
  const [filter, setFilter] = useState<'all' | 'draft' | 'assessed'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const filtered = useMemo(() => filter === 'all' ? travels : travels.filter((travel) => travel.status === filter), [filter, travels])
  const selected = travels.find((travel) => travel.id === selectedId)
  const itemCount = travels.reduce((sum, travel) => sum + travel.items.length, 0)
  const packedCount = travels.reduce((sum, travel) => sum + travel.packedItemIds.length, 0)
  const destinationCount = new Set(travels.map((travel) => travel.destination.trim()).filter(Boolean)).size
  return <div className="screen-stack library-screen">
    <section className="gallery-section travel-record-hero">
      <header className="section-heading compact-heading"><div className="section-heading-title"><UiIcon name="album" /><div><p className="eyebrow">TRAVEL RECORDS</p><h1>여행 기록</h1><p>여행별 준비 현황과 판정을 마친 물품을 한곳에서 확인합니다.</p></div></div></header>
      <div className="travel-gallery-metrics">
        <div><strong>{travels.length}</strong><span>여행</span></div><div><strong>{destinationCount}</strong><span>목적지</span></div><div><strong>{itemCount}</strong><span>등록 물품</span></div><div><strong>{itemCount ? Math.round(packedCount / itemCount * 100) : 0}%</strong><span>평균 준비</span></div>
      </div>
      <div className="filter-row" role="group" aria-label="여행 기록 필터">{([['all', '전체'], ['draft', '준비 중'], ['assessed', '판정 완료']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
      {!travels.length && <div className="empty-state"><strong>저장한 여행이 없습니다.</strong><p>여행 홈에서 날짜·목적지 또는 물품을 입력하면 자동으로 기록됩니다.</p></div>}
      {!!travels.length && !filtered.length && <div className="empty-state"><strong>해당 상태의 여행이 없습니다.</strong></div>}
      <div className="travel-gallery">{filtered.map((travel) => {
        const packed = travel.packedItemIds.filter((id) => travel.items.some((item) => item.id === id)).length
        const progress = travel.items.length ? Math.round(packed / travel.items.length * 100) : 0
        const airline = airlines.find((entry) => entry.id === travel.airlineId)?.name ?? '항공사 미확인'
        return <article className={selectedId === travel.id ? 'travel-tile selected' : 'travel-tile'} key={travel.id}>
          <div className="travel-cover"><Cover blob={travel.coverPhoto} title={travel.title} /><span>{travel.status === 'assessed' ? '판정 완료' : '준비 중'}</span></div>
          <div><small>{travel.date || '날짜 미정'} · {countryName(travel.origin)} → {travel.destination ? countryName(travel.destination) : '목적지 미정'}</small><h2>{travel.title || '이름 없는 여행'}</h2><p>{airline} · {travel.flightType === 'domestic' ? '국내선' : '국제선'}</p><div className="packing-progress"><span><i style={{ width: `${progress}%` }} /></span><b>{packed}/{travel.items.length} 챙김</b></div></div>
          <footer><button className="secondary-action" onClick={() => setSelectedId(selectedId === travel.id ? null : travel.id)}>상세 보기</button><button className="text-button" onClick={() => onOpen(travel)}>이어서 준비</button><button className="danger-action" onClick={() => onDelete(travel)} aria-label={`${travel.title} 삭제`}>삭제</button></footer>
        </article>
      })}</div>
      {selected && <aside className="travel-detail-panel" aria-live="polite">
        <header><div><p className="eyebrow">TRIP DETAIL</p><h2>{selected.title}</h2><p>{selected.date || '날짜 미정'} · {countryName(selected.origin)} → {selected.destination ? countryName(selected.destination) : '목적지 미정'}</p></div><button className="text-button" onClick={() => setSelectedId(null)}>닫기</button></header>
        <ul>{selected.items.map((item) => <li key={item.id} className={selected.packedItemIds.includes(item.id) ? 'packed' : ''}><span aria-hidden="true">{selected.packedItemIds.includes(item.id) ? '✓' : '○'}</span><div><strong>{item.name}</strong><small>{item.fields.modelName ?? '모델명 미확인'} · {item.confirmed ? '제품 정보 확인' : '정보 확인 필요'}</small></div></li>)}</ul>
        {!selected.items.length && <div className="empty-state"><strong>등록한 물품이 없습니다.</strong></div>}
      </aside>}
    </section>
    <Catalog revision={catalogRevision} currentRuleVersion={currentRuleVersion} rulesCurrent={rulesCurrent} />
    <details className="legacy-data">
      <summary>이전 버전 기록 보기</summary>
      <p>기존에 저장한 데이터는 삭제하지 않고 읽기 영역에 보존합니다.</p>
      <TravelAlbum items={items} photos={photos} onRestore={onRestore} readOnly />
      <LegacyCatalog />
    </details>
  </div>
}
