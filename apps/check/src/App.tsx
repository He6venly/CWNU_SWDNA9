import { useEffect, useRef, useState } from 'react'
import { ApiError, createApiClient } from '../../../contract/client.ts'
import { DEMO_AIRLINE_ID, FIELD_KEYS } from '../../../contract/constants.ts'
import { resultPreviews } from '../../../contract/examples.ts'
import { labels } from '../../../contract/labels.ts'
import type { DetectedItem, ItemInfo, ItemResult } from '../../../contract/types.ts'
import { prepareImage } from './image.ts'

const api = createApiClient()
type Trace = { operation: string; request: unknown; response: unknown; elapsedMs: number }

export default function App() {
  const [status, setStatus] = useState('상태 확인 중')
  const [airlines, setAirlines] = useState<Array<{ id: string; name: string; enabled: boolean }>>([])
  const [airlineId, setAirlineId] = useState(DEMO_AIRLINE_ID)
  const [image, setImage] = useState<{ mimeType: 'image/jpeg'; base64: string } | null>(null)
  const [preview, setPreview] = useState('')
  const [items, setItems] = useState<ItemInfo[]>([])
  const [results, setResults] = useState<ItemResult[]>([])
  const [trace, setTrace] = useState<Trace | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const active = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const previewUrl = useRef('')

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([api.health(controller.signal), api.meta(controller.signal), api.airlines(controller.signal)]).then(([health, meta, list]) => {
      setStatus(`API 정상 · 계약 ${health.meta.contractVersion} · 인식 ${meta.capabilities.recognition} · 제품 조회 ${meta.capabilities.productLookup} · 판정 ${meta.capabilities.evaluation}`)
      setAirlines(list.airlines)
    }).catch(() => { if (!controller.signal.aborted) setStatus('API 연결 실패. npm run dev로 실행했는지 확인해 주세요.') })
    return () => { controller.abort(); active.current?.abort(); URL.revokeObjectURL(previewUrl.current) }
  }, [])

  function invalidate() {
    sequence.current++; active.current?.abort(); setBusy(false); setResults([])
  }
  async function run<T>(operation: string, request: unknown, call: (signal: AbortSignal) => Promise<T>, apply: (value: T) => void) {
    active.current?.abort()
    const id = ++sequence.current
    const controller = new AbortController(); active.current = controller
    const started = performance.now()
    setBusy(true); setMessage(''); setTrace(null)
    try {
      const response = await call(controller.signal)
      if (id !== sequence.current || controller.signal.aborted) return
      apply(response)
      setTrace({ operation, request, response, elapsedMs: Math.round(performance.now() - started) })
    } catch (error) {
      if (id !== sequence.current || controller.signal.aborted) return
      const text = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'
      setMessage(text)
      setTrace({ operation, request, response: error instanceof ApiError ? { error: { code: error.code, message: text }, status: error.status } : { error: text }, elapsedMs: Math.round(performance.now() - started) })
    } finally { if (id === sequence.current) setBusy(false) }
  }
  async function selectPhoto(file?: File) {
    if (!file) return
    invalidate(); setImage(null); setItems([]); setMessage(''); setTrace(null)
    URL.revokeObjectURL(previewUrl.current); previewUrl.current = ''; setPreview('')
    const id = sequence.current
    const controller = new AbortController(); active.current = controller; setBusy(true)
    try {
      const prepared = await prepareImage(file, controller.signal)
      if (id !== sequence.current || controller.signal.aborted) { URL.revokeObjectURL(prepared.preview); return }
      previewUrl.current = prepared.preview; setPreview(prepared.preview); setImage(prepared.image)
      setMessage(`사진 준비 완료 · ${Math.round(prepared.bytes / 1024)}KiB · 서버에 저장하지 않음`)
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '사진을 처리하지 못했습니다.')
    } finally { if (id === sequence.current) setBusy(false) }
  }
  function editItem(id: string, patch: Partial<ItemInfo>) {
    invalidate(); setTrace(null); setMessage('정보가 변경되었습니다. 다시 판정해 주세요.')
    setItems(current => current.map(item => item.id === id ? { ...item, ...patch, userEdited: true } : item))
  }
  const applyRecognized = (detected: DetectedItem[]) => {
    setItems(detected.map(item => ({ ...item, confirmed: false, userEdited: false }))); setResults([])
    if (!detected.length) setMessage('인식된 물품이 없습니다. 사진을 다시 등록해 주세요.')
  }
  return <main>
    <h1>{labels.title}</h1><p>내부 API 체크 화면 · 사용자용 디자인은 별도 작업</p>
    <aside><strong>{labels.demoBanner}</strong><p>{labels.stubBanner}</p><p>{labels.referenceNotice}</p></aside>
    <section aria-labelledby="state"><h2 id="state">1. API·항공사</h2><p role="status">{status}</p>
      <label>항공사 <select value={airlineId} disabled={busy} onChange={e => { invalidate(); setAirlineId(e.target.value); setItems([]); setTrace(null) }}>
        {(airlines.length ? airlines : [{ id: DEMO_AIRLINE_ID, name: '시연 항공사', enabled: true }]).map(a => <option key={a.id} value={a.id} disabled={!a.enabled}>{a.name}</option>)}
      </select></label>
      <button disabled={busy} onClick={() => void run('categories', { airlineId }, signal => api.categories(airlineId, signal), () => {})}>필수 입력 필드 조회</button>
    </section>
    <section aria-labelledby="photo"><h2 id="photo">2. 사진 등록·시연 인식</h2>
      <p>이미 찍어 둔 사진을 기기의 사진 보관함이나 파일에서 선택해 주세요.</p>
      <label>기존 물품 사진 선택 <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
        const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void selectPhoto(file)
      }} /></label>
      {preview && <img className="photo" src={preview} alt="등록한 물품 사진" />}
      <button disabled={busy || !image} onClick={() => {
        if (!image) return
        const request = { airlineId, image }
        void run('recognize', { airlineId, image: { mimeType: image.mimeType, base64: '[사진 데이터 생략]' } }, signal => api.recognize(request, signal), response => applyRecognized(response.items))
      }}>시연 인식 요청 (사진과 무관한 고정 4개)</button>
    </section>
    <section aria-labelledby="edit"><h2 id="edit">3. 인식 정보 확인·수정</h2>
      {items.length === 0 && <p>사진 인식 후 목록이 표시됩니다.</p>}
      {items.map(item => <fieldset key={item.id}><legend>{item.name}</legend>
        <label>물품명 <input value={item.name} maxLength={120} onChange={e => editItem(item.id, { name: e.target.value })} /></label>
        <label>카테고리 <select value={item.categoryId ?? ''} onChange={e => editItem(item.id, { categoryId: (e.target.value || null) as ItemInfo['categoryId'] })}>
          <option value="">미확인</option><option value="power-bank">보조배터리</option><option value="cordless-iron">무선 고데기</option><option value="liquid">액체·젤류</option><option value="lighter">라이터</option><option value="electronics">일반 전자기기</option>
        </select></label>
        {FIELD_KEYS.map(key => <label key={key}>{labels.fields[key]} <input type={key === 'modelName' ? 'text' : 'number'} min={key === 'modelName' ? undefined : 0} step={key === 'count' ? 1 : 'any'} value={item.fields[key] ?? ''} onChange={e => {
          const value = e.target.value === '' ? null : key === 'modelName' ? e.target.value : Number(e.target.value)
          const fields = { ...item.fields, [key]: value }
          editItem(item.id, { fields, unreadFields: FIELD_KEYS.filter(field => fields[field] === null) })
        }} /></label>)}
        <label><input type="checkbox" checked={item.confirmed} onChange={e => editItem(item.id, { confirmed: e.target.checked })} />사용자 확인</label>
        <button disabled={busy} onClick={() => void run('resolve-product', { airlineId, item }, signal => api.resolveProduct({ airlineId, item }, signal), response => setMessage(response.message))}>제품 정보 조회 (현재 시연용)</button>
      </fieldset>)}
      <button disabled={busy || !items.length} onClick={() => void run('evaluate', { airlineId, items }, signal => api.evaluate({ airlineId, items }, signal), response => setResults(response.results))}>판정 API 요청 (현재 고정 응답)</button>
      {results.map(result => <article key={result.itemId}><h3>{items.find(i => i.id === result.itemId)?.name}</h3>
        <p>기내: {labels.verdicts[result.cabin.verdict]} · {result.cabin.reason}</p><p>위탁: {labels.verdicts[result.checked.verdict]} · {result.checked.reason}</p>
        <p>조치: {labels.actions[result.action]} · 누락: {result.missingFields.map(f => labels.fields[f]).join(', ') || '없음'}</p><p>{result.staffSummary}</p>
      </article>)}
    </section>
    <section><h2>4. 프론트 디자인용 결과 목업</h2><p>아래 예시는 실제 판정과 독립된 고정 목업입니다. 제품 값을 바꿔도 목업 결과는 바뀌지 않습니다.</p>
      <div className="previews">{resultPreviews.map(p => <details key={p.id}><summary>{p.title}</summary><p>기내: {labels.verdicts[p.result.cabin.verdict]} / 위탁: {labels.verdicts[p.result.checked.verdict]}</p><p>{p.result.staffSummary}</p><pre>{JSON.stringify(p.result, null, 2)}</pre></details>)}</div>
    </section>
    <section><h2>5. 마지막 요청·응답</h2>
      {busy && <p role="status">처리 중… <button onClick={() => { invalidate(); setMessage('요청을 취소했습니다.') }}>취소</button></p>}
      <p role="status" aria-live="polite">{message}</p>
      {trace && <><p>{trace.operation} · {trace.elapsedMs}ms</p><h3>요청 (사진 데이터 제외)</h3><pre>{JSON.stringify(trace.request, null, 2)}</pre><h3>응답</h3><pre>{JSON.stringify(trace.response, null, 2)}</pre></>}
    </section>
  </main>
}
