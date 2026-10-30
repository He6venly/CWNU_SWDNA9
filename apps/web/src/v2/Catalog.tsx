import { useEffect, useState } from 'react'
import type { SavedCard as CatalogCard } from './catalogStore'
import { deleteCatalogCard, listCatalogCards } from './catalogStore'
import { labels } from '../../../../contract/v2/labels.ts'
import StaffCard from './StaffCard.tsx'
import { useCatalogPhotos } from './useCatalogPhotos.ts'
import UiIcon from '../../../check/src/UiIcon.tsx'

function Entry({
  card,
  onDelete,
}: {
  card: CatalogCard
  onDelete: () => void
}) {
  const { photos } = useCatalogPhotos(card.photoKeys.slice(0, 1))
  return (
    <article className="catalog-card">
      <div className="catalog-thumb">
      {photos[0] ? (
        <img
          src={photos[0]}
          alt={`저장한 물품: ${card.item.name}`}
        />
      ) : <span aria-hidden="true">✓</span>}
      </div>
      <div className="catalog-card-copy">
        <div className="catalog-title-row"><div><p className="eyebrow">CHECKED ITEM</p><h3>{card.item.name}</h3></div><span className="saved-date">{card.savedAt.slice(0, 10)}</span></div>
        <dl className="catalog-meta">
          <div><dt>제품</dt><dd>{card.item.fields.modelName ?? '모델명 미확인'}</dd></div>
          <div><dt>판정 기준</dt><dd>{card.airline.name}</dd></div>
        </dl>
        <div className="catalog-verdicts">
          <span className={`verdict-chip verdict-${card.result.cabin.verdict}`}><small>기내</small><strong>{labels.verdicts[card.result.cabin.verdict]}</strong></span>
          <span className={`verdict-chip verdict-${card.result.checked.verdict}`}><small>위탁</small><strong>{labels.verdicts[card.result.checked.verdict]}</strong></span>
        </div>
        <details className="catalog-summary"><summary>판정 요약 보기</summary><p>{card.result.staffSummary}</p></details>
        <div className="catalog-actions"><button className="danger-action" onClick={onDelete}>삭제</button></div>
      </div>
    </article>
  )
}
export default function Catalog({
  revision,
  currentRuleVersion,
  rulesCurrent,
}: {
  revision: number
  currentRuleVersion: string | null
  rulesCurrent: boolean
}) {
  const [cards, setCards] = useState<CatalogCard[]>([]),
    [showStaff, setShowStaff] = useState(false),
    [message, setMessage] = useState(''),
    [change, setChange] = useState(0)
  useEffect(() => {
    let active = true
    void listCatalogCards()
      .then((values) => {
        if (active) {
          setCards(values)
          setMessage('')
        }
      })
      .catch(() => {
        if (active)
          setMessage(
            '저장한 물품을 읽지 못했습니다. 브라우저 저장 기능을 확인해 주세요.',
          )
      })
    return () => {
      active = false
    }
  }, [revision, change])
  async function remove(card: CatalogCard) {
    try {
      await deleteCatalogCard(card)
      setChange((value) => value + 1)
    } catch {
      setMessage('삭제하지 못했습니다. 다시 시도해 주세요.')
    }
  }
  return (
    <section id="catalog" className="card-section catalog-section">
      <div className="section-heading"><UiIcon name="catalog" /><div><p className="eyebrow">CHECKED ITEMS</p><h2>저장한 물품</h2><p>판정을 마친 물품 정보와 직원 제시 화면을 다시 확인합니다.</p></div></div>
      <p className="local-storage-note">이 기기의 브라우저에만 저장되며 다른 기기와 자동 동기화되지 않습니다.</p>
      {!!cards.length && <button className="primary-action full-action catalog-staff-action" onClick={() => setShowStaff(true)}>저장한 물품 전체 직원에게 보여주기</button>}
      {message && <p role="status">{message}</p>}
      {!cards.length && (
        <div className="empty-state"><strong>저장한 물품이 없습니다.</strong><p>판정 결과에서 확인한 물품을 저장해 주세요.</p></div>
      )}
      <div className="catalog-grid">{cards.map((card) => (
        <Entry
          key={card.id}
          card={card}
          onDelete={() => void remove(card)}
        />
      ))}</div>
      {showStaff && !!cards.length && (
        <StaffCard
          cards={cards}
          onClose={() => setShowStaff(false)}
          currentRuleVersion={currentRuleVersion}
          rulesCurrent={rulesCurrent}
        />
      )}
    </section>
  )
}
