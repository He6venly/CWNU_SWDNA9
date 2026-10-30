import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import type {
  Airline,
  EvaluateResponse,
  FlightType,
  ItemInfo,
  LookupResponse,
  RecognizeRequest,
  RecognizeResponse,
} from '../../../../contract/v2/types.ts'
import type { Source } from '../../../../contract/types.ts'
import type { Photo } from './PhotoPicker'
import { FIELD_KEYS } from '../../../../contract/v2/constants.ts'
import { mergeLabel } from './mergeLabel.ts'
import { recognizeCached } from './recognitionCache.ts'
import { DEPARTURE_COUNTRY } from '../../../../contract/v2/constants.ts'
import { applyCandidate } from '../../../../contract/v2/apply-candidate.ts'
import { saveCatalogCard } from './catalogStore'
import { useCheckTask } from './useCheckTask'
export function useTravelWorkbench() {
  const [refresh, setRefresh] = useState(0)
  const [itemPhotos, setItemPhotos] = useState<Record<string, Photo[]>>({})
  const [status, setStatus] = useState('API 상태 확인 중'),
    [airlines, setAirlines] = useState<Airline[]>([])
  const [captureMode, setCaptureMode] = useState<'overview' | 'detail'>(
      'overview',
    ),
    [mode, setMode] = useState<'label' | 'estimate'>('label')
  const [flightType, setFlightType] = useState<FlightType>('domestic'),
    [airlineId, setAirlineId] = useState('korean-air')
  const [inventoryComplete, setInventoryComplete] = useState(false)
  const [ruleInfo, setRuleInfo] = useState<Awaited<
    ReturnType<typeof api.rules>
  > | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([]),
    [preparing, setPreparing] = useState(false)
  const [items, setItems] = useState<ItemInfo[]>([]),
    [assessment, setAssessment] = useState<EvaluateResponse | null>(null),
    [evaluatedAt, setEvaluatedAt] = useState('')
  const [catalogRevision, setCatalogRevision] = useState(0),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState<string[]>([])
  const [productSources, setProductSources] = useState<
    Record<string, Source[]>
  >({})
  const savingRef = useRef(false),
    results = assessment?.results ?? []
  const [lookups, setLookups] = useState<Record<string, LookupResponse>>({}),
    [demoRecognition, setDemoRecognition] = useState(true)

  const task = useCheckTask(),
    busy = task.busy || preparing || saving
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      api.health(controller.signal),
      api.meta(controller.signal),
      api.airlines(controller.signal),
    ])
      .then(([health, metadata, list]) => {
        setStatus(
          `계약 ${health.meta.contractVersion} · 사진 인식: ${metadata.meta.isDemoRecognition ? '시연' : metadata.capabilities.recognition} · 제품 조회: ${metadata.meta.isDemoLookup ? '시연' : metadata.capabilities.productLookup} · 규정 판정: ${metadata.meta.isDemoRules ? '시연' : metadata.capabilities.evaluation}`,
        )
        setAirlines(list.airlines)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus('API 연결 실패. npm run dev로 실행해 주세요.')
      })
    return () => controller.abort()
  }, [refresh])
  useEffect(() => {
    const controller = new AbortController()
    void api.rules(airlineId, controller.signal).then(setRuleInfo).catch(() => {
      if (!controller.signal.aborted) setRuleInfo(null)
    })
    return () => controller.abort()
  }, [airlineId, refresh])
  function invalidate() {
    task.cancel()
    setAssessment(null)
    setSaved([])
  }
  function resetPhotos() {
    invalidate()
    setPhotos([])
    setPreparing(false)
  }
  function updateItem(changed: ItemInfo) {
    invalidate()
    setItems((current) =>
      current.map((item) => (item.id === changed.id ? changed : item)),
    )
    setLookups((current) => {
      const next = { ...current }
      delete next[changed.id]
      return next
    })
    const used = new Set(
      Object.values(changed.fieldSources).map((source) => source?.sourceUrl),
    )
    setProductSources((current) => ({
      ...current,
      [changed.id]: (current[changed.id] ?? []).filter((source) =>
        used.has(source.url),
      ),
    }))
  }
  function applyRecognition(response: RecognizeResponse) {
    setDemoRecognition(response.meta.isDemoRecognition)
    const recognized = response.items.map((item) => ({
      ...item,
      id: `item-${crypto.randomUUID()}`,
      confirmed: false,
      userEdited: false,
    }))
    setItems((current) => [...current, ...recognized])
    setItemPhotos((current) => ({
      ...current,
      ...Object.fromEntries(
        recognized.map((item) => [
          item.id,
          photos.filter((photo) =>
            item.imageId ? photo.id === item.imageId : true,
          ),
        ]),
      ),
    }))
    setAssessment(null)
    setSaved([])
    task.setMessage(
      [
        response.meta.isDemoRecognition
          ? '시연 인식 결과입니다.'
          : 'AI 인식 결과입니다. 실제 물품을 확인해 주세요.',
        ...response.warnings.map((w) => w.message),
        response.suggestRetake
          ? '사진이 불명확합니다. 사진을 교체해 주세요.'
          : '',
        response.needsLabelPhoto
          ? '라벨 사진 또는 직접 입력이 필요합니다.'
          : '',
        response.captureMode === 'detail' && response.multipleItemsDetected
          ? '개별 사진에는 한 물품만 포함해 주세요.'
          : '',
        response.items.length === 0
          ? '인식된 물품이 없습니다. 사진 교체 또는 직접 입력으로 계속할 수 있습니다.'
          : '',
      ].join(' '),
    )
  }
  async function saveItem(item: ItemInfo, savedAt: string) {
    if (
      !assessment ||
      !item.confirmed ||
      savingRef.current ||
      saved.includes(item.id)
    )
      return
    const result = assessment.results.find(
        (result) => result.itemId === item.id,
      ),
      airline = airlines.find((airline) => airline.id === assessment.airlineId)
    if (!result || !airline) return
    savingRef.current = true
    setSaving(true)
    try {
      const id = `card-${crypto.randomUUID()}`
      const attached =
        item.identification === 'manual'
          ? []
          : itemPhotos[item.id] ?? photos.filter(photo => photo.id === item.imageId)
      const blobs = Object.fromEntries(
        attached.map((photo, index) => {
          const bytes = Uint8Array.from(atob(photo.base64), (character) =>
            character.charCodeAt(0),
          )
          return [
            `${id}-photo-${index + 1}`,
            new Blob([bytes], { type: photo.mimeType }),
          ]
        }),
      )
      await saveCatalogCard(
        {
          id,
          photoKeys: Object.keys(blobs),
          item,
          result,
          airline,
          flightType: assessment.flightType,
          departureCountry: assessment.departureCountry,
          productSources: productSources[item.id] ?? [],
          savedAt,
          evaluatedAt,
          ruleVersion: assessment.ruleVersion,
          meta: assessment.meta,
          assessmentContext: {
            inventoryComplete,
            evaluatedItemIds: items.map((entry) => entry.id),
          },
        },
        blobs,
        items,
      )
      setSaved((current) => [...current, item.id])
      setCatalogRevision((value) => value + 1)
      task.setMessage(
        '여행 기록에 물품을 저장했습니다. 직원 제시 화면을 열 수 있습니다.',
      )
    } catch (error) {
      task.setMessage(
        error instanceof Error ? error.message : '물품 기록을 저장하지 못했습니다.',
      )
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  function request(): RecognizeRequest {
    const images = photos.map(({ preview: _preview, ...image }) => image)
    return captureMode === 'overview'
      ? { captureMode, images }
      : { captureMode, mode, images }
  }
  function analyze() {
    invalidate()
    const input = request()
    void task.run('사진 분석', null, signal => recognizeCached(input, status, signal), applyRecognition)
  }
  function analyzeLabel(item: ItemInfo, selected: Photo[]) {
    invalidate()
    const input: RecognizeRequest = { captureMode: 'detail', mode: 'label', targetItemId: item.id,
      images: selected.map(({ preview: _preview, ...photo }) => photo) }
    void task.run('라벨 보완', null, signal => recognizeCached(input, status, signal), response => {
      const label = response.items[0]
      if (!label) { task.setMessage('라벨을 읽지 못했습니다. 기존 목록은 유지됩니다.'); return }
      updateItem(mergeLabel(item, label))
      setItemPhotos(current => ({ ...current, [item.id]: selected }))
      task.setMessage('선택한 물품의 빈 사양을 보완했습니다. 제품 일치 여부와 정보를 다시 확인해 주세요.')
    })
  }
  function restoreItems(restored: ItemInfo[]) {
    invalidate(); setPhotos([]); setItemPhotos({}); setLookups({}); setProductSources({}); setInventoryComplete(false)
    setItems(restored.map(item => ({ ...item, id: 'manual-' + crypto.randomUUID(), identification: 'manual', imageId: undefined,
      estimate: undefined, bbox: undefined, confirmed: false, userEdited: true,
      fieldSources: Object.fromEntries(FIELD_KEYS.filter(key => item.fields[key] !== null).map(key => [key,
        { source: 'user', confirmed: true, ...(key === 'volts' ? { voltageType: item.fieldSources.volts?.voltageType ?? 'unknown' } : {}) }])),
      ...(item.details ? { details: { ...item.details, confirmed: false } } : {}),
    })))
    task.setMessage('과거 목록을 직접 입력 초안으로 복사했습니다. 현재 제품·수량·안전 상태를 확인하고 재판정해 주세요.')
  }
  function lookupItem(item: ItemInfo) {
    if (!item.fields.modelName) return
    const body = {
      itemId: item.id,
      categoryId: item.categoryId,
      modelName: item.fields.modelName,
      brand: item.fields.brand,
    }
    void task.run(
      '제품 조회',
      null,
      (signal) => api.lookup(body, signal),
      (response) => {
        setLookups((current) => ({ ...current, [item.id]: response }))
        task.setMessage(response.message)
      },
    )
  }
  function chooseCandidate(
    item: ItemInfo,
    candidate: LookupResponse['candidates'][number],
  ) {
    const changed = applyCandidate(item, candidate),
      used = new Set(
        Object.values(changed.fieldSources).map((source) => source?.sourceUrl),
      )
    updateItem(changed)
    setProductSources((current) => ({
      ...current,
      [item.id]: candidate.sources.filter((source) => used.has(source.url)),
    }))
    task.setMessage(
      '빈 정보에 후보를 적용했습니다. 제품 일치 여부를 다시 확인해 주세요.',
    )
  }
  function evaluate() {
    invalidate()
    const body = {
      airlineId,
      flightType,
      departureCountry: DEPARTURE_COUNTRY,
      inventoryComplete,
      items,
      resultFormat: 'detailed' as const,
    }
    void task.run(
      '반입 판정',
      null,
      (signal) => api.evaluate(body, signal),
      (response) => {
        setAssessment(response)
        setEvaluatedAt(new Date().toISOString())
        setSaved([])
      },
    )
  }
  return {
    analyze,
    analyzeLabel,
    restoreItems,
    albumPhotos: [...photos, ...items.flatMap(item => itemPhotos[item.id] ?? [])],
    status,
    airlines,
    captureMode,
    setCaptureMode,
    mode,
    setMode,
    flightType,
    setFlightType,
    airlineId,
    setAirlineId,
    inventoryComplete,
    setInventoryComplete,
    ruleInfo,
    photos,
    setPhotos,
    setPreparing,
    items,
    setItems,
    catalogRevision,
    saving,
    saved,
    results,
    lookups,
    demoRecognition,
    task,
    busy,
    invalidate,
    resetPhotos,
    updateItem,
    applyRecognition,
    saveItem,
    request,
    setRefresh,
    lookupItem,
    chooseCandidate,
    evaluate,
  }
}
