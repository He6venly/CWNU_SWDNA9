import { useEffect, useState } from 'react'
import type { CatalogCard } from '../../../contract/v2/types.ts'
import { deleteCatalogCard, listCatalogCards } from '../../../contract/v2/catalog-store.ts'
import { labels } from '../../../contract/v2/labels.ts'
import StaffCard from './StaffCard.tsx'
import { useCatalogPhotos } from './useCatalogPhotos.ts'

function Entry({ card, onOpen, onDelete }: { card: CatalogCard; onOpen: () => void; onDelete: () => void }) {
  const { photos } = useCatalogPhotos(card.photoKeys.slice(0, 1))
  return <article><h3>{card.item.name}</h3>{photos[0] && <img className="photo" src={photos[0]} alt={`저장한 물품: ${card.item.name}`} />}
    <p>{card.item.fields.modelName ?? '모델명 미확인'} · {card.airline.name}</p><p>기내 {labels.verdicts[card.result.cabin.verdict]} / 위탁 {labels.verdicts[card.result.checked.verdict]}</p>
    <p>{card.result.staffSummary}</p><button onClick={onOpen}>직원에게 보여주기 / Staff view</button><button onClick={onDelete}>삭제</button></article>
}
export default function Catalog({ revision, currentRuleVersion, rulesCurrent }: { revision: number; currentRuleVersion: string | null; rulesCurrent: boolean }) {
  const [cards, setCards] = useState<CatalogCard[]>([]), [selected, setSelected] = useState<CatalogCard | null>(null), [message, setMessage] = useState(''), [change, setChange] = useState(0)
  useEffect(() => {
    let active = true
    void listCatalogCards().then(values => { if (active) { setCards(values); setMessage('') } }).catch(() => { if (active) setMessage('저장한 물품을 읽지 못했습니다. 브라우저 저장 기능을 확인해 주세요.') })
    return () => { active = false }
  }, [revision, change])
  async function remove(card: CatalogCard) {
    try { await deleteCatalogCard(card); setChange(value => value + 1) } catch { setMessage('삭제하지 못했습니다. 다시 시도해 주세요.') }
  }
  return <section><h2>저장한 물품</h2><p>사진·제품 정보는 이 브라우저에 저장됩니다. 다른 기기와 동기화되지 않으며 브라우저 데이터를 지우면 삭제됩니다.</p>
    {message && <p role="status">{message}</p>}{!cards.length && <p>저장된 물품이 없습니다. 판정 후 확인한 물품을 저장해 주세요.</p>}
    {cards.map(card => <Entry key={card.id} card={card} onOpen={() => setSelected(card)} onDelete={() => void remove(card)} />)}
    {selected && <StaffCard card={selected} onClose={() => setSelected(null)} currentRuleVersion={currentRuleVersion} rulesCurrent={rulesCurrent} />}
  </section>
}
