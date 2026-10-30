import { useTravelWorkbench } from './useTravelWorkbench'
import { api } from './api'
import { labels } from '../../../../contract/v2/labels.ts'
import { LIMITS } from '../../../../contract/v2/constants.ts'
import type { FlightType } from '../../../../contract/v2/types.ts'
import { createManualItem, quickItems } from '../../../../contract/v2/manual.ts'
import PhotoSection from './PhotoSection'
import ItemEditor from './ItemEditorV2'
import LookupCandidates from './LookupCandidates'
import ResultCard from './ResultCard'
import Catalog from './Catalog'
import LegacyCatalog from './LegacyCatalog'
export default function TravelApp() {
  const {
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
  } = useTravelWorkbench()
  return (
    <main className="travel">
      <h1>여행 짐 반입 확인</h1>
      <aside>
        <p>{labels.referenceNotice}</p>
        <p>
          사진 분석과 제품 조회는 버튼을 누를 때만 실행됩니다. 실제 AI 사용 시
          사진·입력 정보가 서버를 통해 외부 제공자에게 전달됩니다.
        </p>
      </aside>
      <section>
        <h2>1. 항공사·노선 선택</h2>
        <p role="status">{status}</p>
        <button
          disabled={busy}
          onClick={() => {
            invalidate()
            setRefresh((value) => value + 1)
          }}
        >
          규정·연결 상태 새로 확인
        </button>
        <label>
          항공사
          <select
            value={airlineId}
            disabled={busy}
            onChange={(e) => {
              invalidate()
              setAirlineId(e.target.value)
            }}
          >
            {(airlines.length
              ? airlines
              : [
                  {
                    id: 'korean-air',
                    name: '대한항공 (규정 상태 조회 중)',
                    enabled: false,
                  },
                ]
            ).map((a) => (
              <option key={a.id} value={a.id} disabled={!a.enabled}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <p>
          여행자 1명 · 대한항공 직접 운항편의 한국 국내선·한국 출발 국제선
          기준입니다. 공동운항·환승편과 목적지 세관·검역은 별도 확인해야 합니다.
        </p>
        {ruleInfo && (
          <details>
            <summary>규정 근거·검수 상태</summary>
            <p>
              {ruleInfo.ruleVersion ?? '재검수 필요'} · 재검수 기한{' '}
              {ruleInfo.reviewBy}
            </p>
            <p>{ruleInfo.scope.notice}</p>
            {ruleInfo.sources.map((source) => (
              <p key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                </a>
              </p>
            ))}
          </details>
        )}
        <label>
          노선
          <select
            disabled={busy}
            value={flightType}
            onChange={(e) => {
              invalidate()
              setFlightType(e.target.value as FlightType)
            }}
          >
            <option value="domestic">한국 국내선</option>
            <option value="international">한국 출발 국제선</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            disabled={busy}
            checked={inventoryComplete}
            onChange={(e) => {
              invalidate()
              setInventoryComplete(e.target.checked)
            }}
          />
          여행자 1명의 전체 물품 목록입니다. 부분 목록이면 합산 한도를 별도
          확인합니다.
        </label>
      </section>
      <PhotoSection
        photos={photos}
        captureMode={captureMode}
        mode={mode}
        busy={busy}
        resetPhotos={resetPhotos}
        setCaptureMode={setCaptureMode}
        setMode={setMode}
        setPhotos={setPhotos}
        setPreparing={setPreparing}
        message={task.setMessage}
        invalidate={invalidate}
        clearRecognized={() =>
          setItems((current) =>
            current.filter((item) => item.identification === 'manual'),
          )
        }
        analyze={() => {
          invalidate()
          const input = request()
          void task.run(
            '사진 분석',
            null,
            (signal) => api.recognize(input, signal),
            applyRecognition,
          )
        }}
      />
      <section>
        <h2>사진 없이 빠른 확인</h2>
        <p>
          사진 인식 없이 직접 입력합니다. 아래 물품을 추가한 뒤 실제 라벨·제품
          정보를 확인하고 판정해 주세요. 다른 물품과 개인 한도도 함께
          계산합니다.
        </p>
        {(Object.keys(quickItems) as Array<keyof typeof quickItems>).map(
          (category) => (
            <button
              key={category}
              disabled={busy || items.length >= LIMITS.maxItems}
              onClick={() => {
                invalidate()
                setItems((current) => [
                  ...current,
                  createManualItem(category, `manual-${crypto.randomUUID()}`),
                ])
                task.setMessage(
                  `${quickItems[category]} 입력 항목을 추가했습니다. 아래에서 제품 정보와 수량을 입력해 주세요.`,
                )
              }}
            >
              {quickItems[category]} 빠른 확인
            </button>
          ),
        )}
      </section>
      <section>
        <h2>3. 물품 정보·출처 확인</h2>
        {items.map((item) => (
          <div key={item.id}>
            <fieldset className="item-lock" disabled={saving}>
              <ItemEditor
                item={item}
                isDemo={demoRecognition}
                onChange={(changed) => {
                  updateItem(changed)
                  task.setMessage('정보가 변경되어 이전 판정을 폐기했습니다.')
                }}
              />
              <button
                disabled={busy || !item.fields.modelName}
                onClick={() => lookupItem(item)}
              >
                모델명으로 제품 조회 (AI 최대 2회)
              </button>
              {lookups[item.id] && (
                <LookupCandidates
                  value={lookups[item.id]!}
                  disabled={busy}
                  onSelect={(candidate) => chooseCandidate(item, candidate)}
                />
              )}
              <button
                disabled={busy}
                onClick={() => {
                  invalidate()
                  setItems((current) =>
                    current.filter((entry) => entry.id !== item.id),
                  )
                }}
              >
                이 물품 제외
              </button>
            </fieldset>
          </div>
        ))}
        <button
          disabled={
            busy ||
            saving ||
            !items.length ||
            items.some((item) => !item.confirmed || !item.name.trim()) ||
            !airlines.some((a) => a.id === airlineId && a.enabled)
          }
          onClick={evaluate}
        >
          입력한 정보로 반입 판정
        </button>
        {results.map((result) => {
          const item = items.find((item) => item.id === result.itemId)
          return (
            item && (
              <ResultCard
                key={result.itemId}
                item={item}
                result={result}
                onSave={() => void saveItem(item, new Date().toISOString())}
                saving={saving}
                saved={saved.includes(item.id)}
              />
            )
          )
        })}
      </section>
      <LegacyCatalog />
      <Catalog
        revision={catalogRevision}
        currentRuleVersion={ruleInfo?.ruleVersion ?? null}
        rulesCurrent={ruleInfo?.current ?? false}
      />
      <aside className="task-status" aria-live="polite">
        {task.busy && (
          <p>
            처리 중…{' '}
            <button
              onClick={() => {
                task.cancel()
                task.setMessage('요청을 취소했습니다. 입력은 보존됩니다.')
              }}
            >
              요청 취소
            </button>
          </p>
        )}
        <p role="status">{task.message}</p>
      </aside>
    </main>
  )
}
