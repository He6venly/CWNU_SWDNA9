import { useEffect, useMemo, useState } from 'react'
import type { ItemInfo } from '../../../../contract/v2/types.ts'
import { labels } from '../../../../contract/v2/labels.ts'
import { useTravelWorkbench } from './useTravelWorkbench.ts'
import TravelHome from './TravelHome.tsx'
import ItemRegistration from './ItemRegistration.tsx'
import TravelLibrary from './TravelLibrary.tsx'
import FlightBackdrop from './FlightBackdrop.tsx'
import BrandLogo from './BrandLogo.tsx'
import LandingScreen from './LandingScreen.tsx'
import { countryName, flightTypeForCountries, normalizeCountry } from './travelCountries.ts'
import {
  activeTravelId,
  deleteTravel,
  getTravel,
  listTravels,
  saveTravel,
  setActiveTravelId,
  type TravelRecord,
} from './travelStore.ts'

type View = 'intro' | 'home' | 'register' | 'catalog'
type TravelMeta = Pick<TravelRecord, 'id' | 'title' | 'date' | 'origin' | 'destination' | 'createdAt'>

function newTravelMeta(): TravelMeta {
  const now = new Date().toISOString()
  return { id: `trip-${crypto.randomUUID()}`, title: '', date: '', origin: 'KR', destination: '', createdAt: now }
}

function localDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function hashView(): View {
  const value = window.location.hash.slice(1)
  if (value === 'results') return 'register'
  return value === 'home' || value === 'register' || value === 'catalog' ? value : 'intro'
}

function photoBlob(base64: string, mimeType: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: mimeType })
}

export default function TravelApp() {
  const workbench = useTravelWorkbench()
  const [view, setView] = useState<View>(hashView)
  const [meta, setMeta] = useState<TravelMeta>(newTravelMeta)
  const [packedItemIds, setPackedItemIds] = useState<string[]>([])
  const [travels, setTravels] = useState<TravelRecord[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [routeError, setRouteError] = useState('')
  const registrationAirlineId = workbench.airlineId
  const registrationFlightType = workbench.flightType
  const setRegistrationAirlineId = workbench.setAirlineId

  const current = useMemo<TravelRecord>(() => ({
    ...meta,
    airlineId: workbench.airlineId,
    flightType: workbench.flightType,
    inventoryComplete: workbench.inventoryComplete,
    items: workbench.items,
    packedItemIds: packedItemIds.filter((id) => workbench.items.some((item) => item.id === id)),
    status: workbench.results.length ? 'assessed' : 'draft',
    updatedAt: new Date().toISOString(),
  }), [meta, packedItemIds, workbench.airlineId, workbench.flightType, workbench.inventoryComplete, workbench.items, workbench.results.length])

  useEffect(() => {
    const sync = () => setView(hashView())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    let active = true
    void listTravels().then((values) => {
      if (!active) return
      setTravels(values)
      const selected = values.find((travel) => travel.id === activeTravelId())
      if (selected) openTravel(selected, false)
    }).catch(() => workbench.task.setMessage('저장한 여행을 불러오지 못했습니다.')).finally(() => { if (active) setHydrated(true) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const meaningful = Boolean(meta.date || meta.origin !== 'KR' || meta.destination.trim() || workbench.items.length || workbench.photos.length)
    if (!meaningful) { setSaveState('idle'); return }
    setSaveState('saving')
    const timer = window.setTimeout(() => { void persistCurrent() }, 700)
    return () => window.clearTimeout(timer)
    // persistCurrent는 현재 렌더의 여행 스냅샷을 저장한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, current, workbench.photos])

  useEffect(() => {
    if (!hydrated || view !== 'register') return
    if (!meta.destination) {
      setRouteError('목적 국가를 먼저 선택해야 물품 등록·판정을 시작할 수 있습니다.')
      changeView('home')
      return
    }
    setMeta((value) => ({
      ...value,
      origin: value.origin || 'KR',
      date: value.date || localDate(),
    }))
    if (!registrationAirlineId) setRegistrationAirlineId('korean-air')
  }, [hydrated, meta.destination, view, registrationAirlineId, registrationFlightType, setRegistrationAirlineId])

  function changeView(next: View) {
    history.replaceState(null, '', `#${next}`)
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function navigate(next: View) {
    if (next === 'register' && !meta.destination) {
      setRouteError('목적 국가를 먼저 선택해야 물품 등록·판정을 시작할 수 있습니다.')
      workbench.task.setMessage('목적 국가를 선택하면 물품 등록·판정으로 이동할 수 있습니다.')
      if (view !== 'home') changeView('home')
      else window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setRouteError('')
    changeView(next)
  }

  function openTravel(travel: TravelRecord, navigate = true) {
    workbench.invalidate()
    workbench.resetPhotos()
    setMeta({ id: travel.id, title: travel.title, date: travel.date, origin: normalizeCountry(travel.origin), destination: normalizeCountry(travel.destination, ''), createdAt: travel.createdAt })
    setPackedItemIds(travel.packedItemIds)
    workbench.setAirlineId(travel.airlineId)
    workbench.setFlightType(travel.flightType)
    workbench.setInventoryComplete(travel.inventoryComplete)
    workbench.setItems(travel.items)
    setSaveState('saved')
    setRouteError('')
    setActiveTravelId(travel.id)
    if (navigate) changeView('home')
  }

  function newTravel() {
    workbench.invalidate()
    workbench.resetPhotos()
    workbench.setItems([])
    workbench.setInventoryComplete(false)
    setPackedItemIds([])
    setSaveState('idle')
    setRouteError('')
    const next = newTravelMeta()
    setMeta(next)
    setActiveTravelId(next.id)
    changeView('home')
  }

  async function refreshTravels() {
    setTravels(await listTravels())
  }

  async function persistCurrent() {
    try {
      const previous = await getTravel(meta.id)
      const firstPhoto = workbench.photos[0]
      const automaticTitle = current.destination.trim()
        ? `${countryName(current.destination.trim())} 여행`
        : current.date
          ? `${current.date.slice(5).replace('-', '.')} 여행`
          : '여행 준비 기록'
      const stored = {
        ...current,
        title: automaticTitle,
        updatedAt: new Date().toISOString(),
        coverPhoto: firstPhoto ? photoBlob(firstPhoto.base64, firstPhoto.mimeType) : previous?.coverPhoto,
      }
      await saveTravel(stored)
      setTravels((values) => [stored, ...values.filter((travel) => travel.id !== stored.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  async function removeTravel(travel: TravelRecord) {
    try {
      await deleteTravel(travel.id)
      await refreshTravels()
      if (travel.id === meta.id) newTravel()
    } catch {
      workbench.task.setMessage('여행을 삭제하지 못했습니다.')
    }
  }

  function restoreItems(items: ItemInfo[]) {
    workbench.restoreItems(items)
    navigate('register')
  }

  function applyFlightType(flightType: TravelRecord['flightType']) {
    if (flightType === workbench.flightType) return
    workbench.invalidate()
    workbench.setFlightType(flightType)
    if (!workbench.airlines.find((airline) => airline.id === workbench.airlineId)?.supportedFlightTypes.includes(flightType)) workbench.setAirlineId('korean-air')
  }

  function changeTravel(patch: Partial<TravelRecord>) {
    const next = { ...meta, ...patch }
    setMeta(next)
    if (patch.destination) setRouteError('')
    if (patch.origin !== undefined || patch.destination !== undefined) applyFlightType(flightTypeForCountries(next.origin, next.destination, workbench.flightType))
  }

  function changeFlightType(flightType: TravelRecord['flightType']) {
    if (flightType === 'domestic') {
      setMeta((value) => ({ ...value, origin: 'KR', destination: 'KR' }))
      setRouteError('')
    } else if (meta.origin === 'KR' && meta.destination === 'KR') {
      setMeta((value) => ({ ...value, destination: '' }))
    }
    applyFlightType(flightType)
  }

  const nav: Array<[View, string]> = [['home', '여행 홈'], ['register', '물품 등록·판정'], ['catalog', '여행 기록']]
  const demoResult = workbench.results.some((result) => result.isDemo)

  if (view === 'intro') return <LandingScreen onEnter={() => changeView('home')} />

  return <div className="app-shell">
    <FlightBackdrop />
    <header className="app-header">
      <button className="brand" onClick={() => changeView('intro')} aria-label="챙기고 시작 화면"><BrandLogo /></button>
      <nav aria-label="주요 화면">{nav.map(([value, label]) => <button key={value} className={view === value ? 'active' : ''} onClick={() => navigate(value)}>{label}</button>)}</nav>
      <span className="local-badge">LOCAL</span>
    </header>

    <div className="mode-banner" role="note">
      <strong>{demoResult || workbench.demoRecognition ? '시연 연동 포함' : '실제 연동'}</strong>
      <span>사진 인식·제품 조회와 규정 판정은 분리되어 실행됩니다. {labels.referenceNotice}</span>
    </div>

    <main className="travel">
      {view === 'home' && <TravelHome current={current} travels={travels} packedItemIds={packedItemIds} airlines={workbench.airlines} saveState={saveState} routeError={routeError} onChange={changeTravel} onAirlineChange={(airlineId) => { workbench.invalidate(); workbench.setAirlineId(airlineId) }} onFlightTypeChange={changeFlightType} onTogglePacked={(itemId) => setPackedItemIds((ids) => ids.includes(itemId) ? ids.filter((id) => id !== itemId) : [...ids, itemId])} onAddItem={() => navigate('register')} onOpen={openTravel} onNew={newTravel} />}
      {view === 'register' && <ItemRegistration workbench={workbench} travel={current} onFlightTypeChange={changeFlightType} onEditTravel={() => changeView('home')} onCatalog={() => changeView('catalog')} />}
      {view === 'catalog' && <TravelLibrary travels={travels} airlines={workbench.airlines} items={workbench.items} photos={workbench.albumPhotos} onOpen={openTravel} onDelete={(travel) => void removeTravel(travel)} onRestore={restoreItems} catalogRevision={workbench.catalogRevision} currentRuleVersion={workbench.ruleInfo?.ruleVersion ?? null} rulesCurrent={workbench.ruleInfo?.current ?? false} />}

      <aside className="task-status" aria-live="polite">
        {workbench.task.busy && <p>처리 중… <button onClick={() => { workbench.task.cancel(); workbench.task.setMessage('요청을 취소했습니다. 입력은 보존됩니다.') }}>요청 취소</button></p>}
        <p role="status">{workbench.task.message}</p>
      </aside>

      <details className="developer-panel">
        <summary>개발·연동 상태</summary>
        <p>{workbench.status}</p>
        <p>규정: {workbench.ruleInfo?.ruleVersion ?? '재검수 필요'} · {workbench.ruleInfo?.current ? '현재 사용 가능' : '실제 판정 비활성'}</p>
        <button className="text-button" disabled={workbench.busy} onClick={() => { workbench.invalidate(); workbench.setRefresh((value) => value + 1) }}>연결 상태 새로 확인</button>
      </details>
      <footer className="app-footer"><strong>챙기고</strong><span>사진과 여행 정보는 현재 브라우저에 자동 저장됩니다.</span></footer>
    </main>
  </div>
}
