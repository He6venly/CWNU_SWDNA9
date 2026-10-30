import type { useTravelWorkbench } from './useTravelWorkbench.ts'
import ResultCard from './ResultCard.tsx'
import UiIcon from '../../../check/src/UiIcon.tsx'

type Workbench = ReturnType<typeof useTravelWorkbench>

export default function AssessmentResults({ workbench, onBack, onCatalog, embedded = false }: { workbench: Workbench; onBack?: () => void; onCatalog: () => void; embedded?: boolean }) {
  const w = workbench
  return <section className="results-screen">
    <header className="result-screen-heading"><div className="section-heading-title"><UiIcon name="verify" /><div><p className="eyebrow">ASSESSMENT</p><h1>등록 물품 판정 결과</h1><p>물품 정보 바로 아래에서 기내 휴대와 위탁 여부를 확인하세요.</p></div></div>{!embedded && onBack && <button className="secondary-action" onClick={onBack}>← 물품 수정</button>}</header>
    {!w.results.length ? <div className="empty-state"><strong>아직 판정 결과가 없습니다.</strong><p>물품 정보를 확인한 뒤 판정을 실행해 주세요.</p>{onBack && <button className="primary-action" onClick={onBack}>물품 등록으로</button>}</div> : w.results.map((result) => {
      const item = w.items.find((entry) => entry.id === result.itemId)
      return item ? <ResultCard key={result.itemId} item={item} result={result} onSave={() => void w.saveItem(item, new Date().toISOString())} saving={w.saving} saved={w.saved.includes(item.id)} /> : null
    })}
    {!!w.results.length && <button className="primary-action full-action" onClick={onCatalog}>여행 기록에 저장한 물품 보기 →</button>}
  </section>
}
