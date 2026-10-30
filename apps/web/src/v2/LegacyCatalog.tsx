import { useEffect, useState } from 'react'
import { catalog } from '../storage'
import type { Card } from '../model'
export default function LegacyCatalog() {
  const [cards, setCards] = useState<Card[]>([]),
    [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    void catalog
      .cards()
      .then((values) => {
        if (alive) setCards(values)
      })
      .catch(() => {
        if (alive) setError('이전 물품 기록을 읽지 못했습니다.')
      })
    return () => {
      alive = false
    }
  }, [])
  return (
    <details className="legacy-catalog">
      <summary>이전 시연 물품 (읽기 전용 · {cards.length}개)</summary>
      <p>
        기존 사진·물품 기록은 원본 그대로 보존됩니다. v2 규정 결과로 승격하지
        않았습니다. 최신 입력 화면에서 다시 확인해 주세요.
      </p>
      {error && <p role="alert">{error}</p>}
      {cards.map((card) => (
        <article key={card.id}>
          <h3>{card.item.name}</h3>
          <p>
            {card.item.model || '모델 미확인'} ·{' '}
            {card.item.amount || '사양 미확인'}
          </p>
          <p>
            이전 시연 결과: 기내 {card.result.cabin} / 위탁{' '}
            {card.result.checked}
          </p>
          <small>{card.savedAt}</small>
        </article>
      ))}
    </details>
  )
}
