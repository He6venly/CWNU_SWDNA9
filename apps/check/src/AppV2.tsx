import { useEffect, useState } from 'react'
import { createApiClient } from '../../../contract/v2/client.ts'
import { createMockClient } from '../../../contract/v2/mock.ts'
import { labels } from '../../../contract/v2/labels.ts'
import type { RecognitionScenario } from '../../../contract/v2/demo.ts'
import type { FlightType, ItemInfo, ItemResult, LookupResponse, RecognizeRequest, RecognizeResponse } from '../../../contract/v2/types.ts'
import requests from '../../../contract/v2/fixtures/requests.json'
import { DEPARTURE_COUNTRY } from '../../../contract/v2/constants.ts'
import { RecognizeRequestSchema } from '../../../contract/v2/schemas.ts'
import PhotoPicker from './PhotoPicker.tsx'
import type { Photo } from './PhotoPicker.tsx'
import ItemEditor from './ItemEditorV2.tsx'
import { useCheckTask } from './useCheckTask.ts'
import LookupCandidates from './LookupCandidates.tsx'
import { applyCandidate } from '../../../contract/v2/apply-candidate.ts'

const api = createApiClient()
export default function AppV2() {
  const [status, setStatus] = useState('API 상태 확인 중'), [airlines, setAirlines] = useState<Array<{ id: string; name: string; enabled: boolean }>>([])
  const [captureMode, setCaptureMode] = useState<'overview' | 'detail'>('overview'), [mode, setMode] = useState<'label' | 'estimate'>('label')
  const [flightType, setFlightType] = useState<FlightType>('domestic'), [airlineId, setAirlineId] = useState('demo-airline')
  const [inventoryComplete, setInventoryComplete] = useState(false)
  const [ruleInfo, setRuleInfo] = useState<Awaited<ReturnType<typeof api.rules>> | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([]), [preparing, setPreparing] = useState(false)
  const [items, setItems] = useState<ItemInfo[]>([]), [results, setResults] = useState<ItemResult[]>([])
  const [lookups, setLookups] = useState<Record<string, LookupResponse>>({}), [demoRecognition, setDemoRecognition] = useState(true)
  const [scenario, setScenario] = useState<RecognitionScenario>('standard')
  const task = useCheckTask(), busy = task.busy || preparing
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([api.health(controller.signal), api.meta(controller.signal), api.airlines(controller.signal), api.rules('korean-air', controller.signal)]).then(([health, metadata, list, rules]) => {
      setStatus(`API ${health.meta.contractVersion} · 인식 ${metadata.capabilities.recognition} · 조회 ${metadata.capabilities.productLookup} · 판정 ${metadata.capabilities.evaluation}`)
      setAirlines(list.airlines)
      setRuleInfo(rules)
    }).catch(() => { if (!controller.signal.aborted) setStatus('API 연결 실패. npm run dev로 실행해 주세요.') })
    return () => controller.abort()
  }, [])
  function invalidate() { task.cancel(); setResults([]) }
  function resetPhotos() { invalidate(); setPhotos([]); setItems([]); setLookups({}); setPreparing(false) }
  function updateItem(changed: ItemInfo) {
    invalidate(); setItems(current => current.map(item => item.id === changed.id ? changed : item))
    setLookups(current => { const next = { ...current }; delete next[changed.id]; return next })
  }
  function applyRecognition(response: RecognizeResponse) {
    setDemoRecognition(response.meta.isDemoRecognition); setLookups({})
    setItems(response.items.map(item => ({ ...item, confirmed: false, userEdited: false })))
    setResults([]); task.setMessage(response.warnings.map(w => w.message).join(' '))
  }
  function request(): RecognizeRequest {
    const images = photos.map(({ preview: _preview, ...image }) => image)
    return captureMode === 'overview' ? { captureMode, images } : { captureMode, mode, images }
  }
  return <main><h1>{labels.title} · API 2.0 체크</h1>
    <aside><strong>{labels.demoBanner}</strong><p>{labels.stubBanner}</p><p>{labels.referenceNotice}</p></aside>
    <section><h2>1. 상태·항공사·노선</h2><p role="status">{status}</p>
      <label>항공사<select value={airlineId} disabled={busy} onChange={e => { invalidate(); setAirlineId(e.target.value) }}>
        {(airlines.length ? airlines : [{ id: 'demo-airline', name: '시연 항공사', enabled: true }]).map(a => <option key={a.id} value={a.id} disabled={!a.enabled}>{a.name}</option>)}
      </select></label>
      <p>여행자 1명 · 대한항공 직접 운항편의 한국 국내선·한국 출발 국제선 기준입니다. 공동운항·환승편과 목적지 세관·검역은 별도 확인해야 합니다.</p>
      {ruleInfo && <details><summary>규정 근거·검수 상태</summary><p>{ruleInfo.ruleVersion ?? '재검수 필요'} · 재검수 기한 {ruleInfo.reviewBy}</p><p>{ruleInfo.scope.notice}</p>{ruleInfo.sources.map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></p>)}</details>}
      <label>노선<select value={flightType} onChange={e => { invalidate(); setFlightType(e.target.value as FlightType) }}><option value="domestic">한국 국내선</option><option value="international">한국 출발 국제선</option></select></label>
      <label><input type="checkbox" checked={inventoryComplete} onChange={e => { invalidate(); setInventoryComplete(e.target.checked) }} />여행자 1명의 전체 물품 목록입니다. 부분 목록이면 합산 한도를 별도 확인합니다.</label>
      <button disabled={busy} onClick={() => void task.run('categories', { airlineId, flightType }, signal => api.categories(airlineId, flightType, signal), () => {})}>노선별 필수 정보 조회</button>
    </section>
    <section><h2>2. 기존 사진 등록</h2><p>{labels.photoNotice}</p>
      <label>사진 등록 방식<select value={captureMode} onChange={e => { resetPhotos(); setCaptureMode(e.target.value as 'overview' | 'detail') }}><option value="overview">전체 짐 사진</option><option value="detail">개별 물품 사진</option></select></label>
      {captureMode === 'detail' && <label>개별 식별 방식<select value={mode} onChange={e => { resetPhotos(); setMode(e.target.value as 'label' | 'estimate') }}><option value="label">라벨 판독</option><option value="estimate">물품 종류 추정</option></select></label>}
      <PhotoPicker key={`${captureMode}-${mode}`} maxImages={captureMode === 'overview' ? 1 : 3} defaultKind={captureMode === 'overview' ? 'overview' : mode === 'label' ? 'label' : 'closeup'}
        onStart={resetPhotos} onChange={setPhotos} onWorking={setPreparing} onMessage={task.setMessage} />
      {photos.map(photo => <div key={photo.id}><img className="photo" alt={`선택한 사진 ${photo.id}`} src={photo.preview} />
        {captureMode === 'detail' && <label>사진 종류<select value={photo.kind} onChange={e => { invalidate(); setItems([]); setPhotos(current => current.map(p => p.id === photo.id ? { ...p, kind: e.target.value as Photo['kind'] } : p)) }}><option value="label">라벨</option><option value="closeup">물품 근접 사진</option></select></label>}
      </div>)}
      <button disabled={busy || !photos.length} onClick={() => {
        const input = request(), redacted = { ...input, images: input.images.map(i => ({ ...i, base64: '[사진 데이터 생략]' })) }
        void task.run('recognize · 현재 Provider', redacted, signal => api.recognize(input, signal), applyRecognition)
      }}>등록 사진 분석 요청 (현재 Provider 상태 확인)</button>
    </section>
    <section><h2>3. 사진 없이 목업 시나리오 확인</h2><p>아래 기능은 프론트 개발용 고정 데이터입니다. 실제 품질 검사·규정 판정이 아닙니다.</p>
      <label>목업 시나리오<select value={scenario} onChange={e => { invalidate(); setScenario(e.target.value as RecognitionScenario) }}>
        <option value="standard">기본</option><option value="empty">인식 0건</option><option value="multiple">개별 사진의 여러 물품</option><option value="no-label">라벨 없음</option><option value="blur">흐림</option><option value="risk-estimate">위험 물품 추정</option><option value="low-confidence">낮은 신뢰도</option>
      </select></label>
      <button disabled={busy} onClick={() => {
        const input = RecognizeRequestSchema.parse(captureMode === 'overview' ? requests.overview : mode === 'label' ? requests.label : requests.estimate)
        const client = createMockClient({ scenario })
        void task.run(`목업 ${scenario}`, { ...input, images: input.images.map(i => ({ ...i, base64: '[예시 이미지 생략]' })) }, signal => client.recognize(input, signal), applyRecognition)
      }}>선택 시나리오 실행 (사진 불필요)</button>
    </section>
    <section><h2>4. 물품 정보·출처 확인</h2>
      {items.map(item => <div key={item.id}><ItemEditor item={item} isDemo={demoRecognition} onChange={changed => {
        updateItem(changed); task.setMessage('정보가 변경되어 이전 판정을 폐기했습니다.')
      }} />
        <button disabled={busy || !item.fields.modelName} onClick={() => {
          if (!item.fields.modelName) return
          const body = { itemId: item.id, categoryId: item.categoryId, modelName: item.fields.modelName, brand: item.fields.brand }
          void task.run('lookup', body, signal => api.lookup(body, signal), response => { setLookups(current => ({ ...current, [item.id]: response })); task.setMessage(response.message) })
        }}>모델명으로 제품 조회</button>
        {lookups[item.id] && <LookupCandidates value={lookups[item.id]!} disabled={busy} onSelect={candidate => {
          updateItem(applyCandidate(item, candidate)); task.setMessage('빈 정보에 후보를 적용했습니다. 출처·제품 일치 여부를 확인한 뒤 물품을 다시 확인해 주세요.')
        }} />}
      </div>)}
      <button disabled={busy || !items.length} onClick={() => {
        const body = { airlineId, flightType, departureCountry: DEPARTURE_COUNTRY, inventoryComplete, items }
        void task.run('evaluate', body, signal => api.evaluate(body, signal), response => setResults(response.results))
      }}>노선별 판정 요청 (대한항공 규정 / 시연 항공사 고정 응답)</button>
      {results.map(result => <article key={result.itemId}><h3>{items.find(i => i.id === result.itemId)?.name}</h3><p>기내: {labels.verdicts[result.cabin.verdict]} · {result.cabin.reason}</p><p>위탁: {labels.verdicts[result.checked.verdict]} · {result.checked.reason}</p><p>{labels.actions[result.action]}</p><p>{result.staffSummary}</p><p>계산값: {result.derivedFields.wh?.displayValue ?? '파생 계산값 없음'}</p></article>)}
    </section>
    <section><h2>5. 마지막 요청·응답</h2>{task.busy && <button onClick={() => { task.cancel(); task.setMessage('요청을 취소했습니다.') }}>요청 취소</button>}<p role="status">{task.message}</p>
      {task.trace && <><p>{task.trace.operation} · {task.trace.elapsedMs}ms</p><h3>요청 (사진 데이터 제외)</h3><pre>{JSON.stringify(task.trace.request, null, 2)}</pre><h3>응답</h3><pre>{JSON.stringify(task.trace.response, null, 2)}</pre></>}
    </section>
  </main>
}
