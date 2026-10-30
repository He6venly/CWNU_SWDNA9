import type { ItemInfo, ItemResult } from '../../../../contract/v2/types.ts'
import { labels } from '../../../../contract/v2/labels.ts'

export default function ResultCard({
  item,
  result,
  onSave,
  saving,
  saved,
}: {
  item: ItemInfo
  result: ItemResult
  onSave?: () => void
  saving?: boolean
  saved?: boolean
}) {
  const view = result.presentation
  return (
    <article className="result-card">
      <h3>{item.name}</h3>
      <p>{result.isDemo ? '시연 결과' : '확인한 정보에 따른 규정 참고 결과'}</p>
      <div className="verdict-grid">
        <div>
          <strong>기내 휴대</strong>
          <p className={`verdict verdict-${result.cabin.verdict}`}>
            {labels.verdicts[result.cabin.verdict]}
          </p>
        </div>
        <div>
          <strong>위탁 수하물</strong>
          <p className={`verdict verdict-${result.checked.verdict}`}>
            {labels.verdicts[result.checked.verdict]}
          </p>
        </div>
        <div>
          <strong>권장 조치</strong>
          <p>{labels.actions[result.action]}</p>
        </div>
      </div>
      {view?.conditions.some((entry) => entry.code === 'ADJUST_QUANTITY') && (
        <p className="staff-warning">
          현재 구성 불가 · 수량을 조정한 뒤 다시 판정해 주세요.
        </p>
      )}
      <h4>해야 할 조건</h4>
      {view?.conditions.length ? (
        <ul>
          {view.conditions.map((entry) => (
            <li key={`${entry.code}-${entry.appliesTo}`}>
              <strong>
                {entry.appliesTo === 'cabin'
                  ? '기내'
                  : entry.appliesTo === 'checked'
                    ? '위탁'
                    : '공통'}
              </strong>{' '}
              · {entry.text}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {result.cabin.verdict === 'NEEDS_INFO' ||
          result.checked.verdict === 'NEEDS_INFO'
            ? '추가 정보를 확인한 뒤 조건을 다시 판정해 주세요.'
            : '아래 결과 설명과 적용 범위를 확인해 주세요.'}
        </p>
      )}
      <h4>추가 확인 정보</h4>
      {view?.requiredInfo.length ? (
        <ul>
          {view.requiredInfo.map((entry) => (
            <li key={entry.key}>{entry.text}</li>
          ))}
        </ul>
      ) : (
        <p>
          {view
            ? '현재 판정에 추가 요청된 정보 없음. 물품·노선이 바뀌면 재판정해 주세요.'
            : '상세 확인 정보가 없는 이전 형식입니다. 결과 설명을 확인하고 다시 판정해 주세요.'}
        </p>
      )}
      {view && (
        <p>
          항공사 승인:{' '}
          {view.airlineApproval === 'required'
            ? '사전 승인 필요'
            : view.airlineApproval === 'not-required'
              ? '현재 확인된 조건에서는 승인 대상 아님'
              : '미판정'}{' '}
          · 기내 사용/충전:{' '}
          {view.inFlightUse === 'prohibited' ? '금지' : '별도 확인'}
        </p>
      )}
      <details>
        <summary>결과 설명</summary>
        <p>기내: {result.cabin.reason}</p>
        <p>위탁: {result.checked.reason}</p>
        {result.derivedFields.wh && (
          <p>
            계산 전력량: {result.derivedFields.wh.displayValue}Wh (공칭 전압
            기준)
          </p>
        )}
      </details>
      <h4>근거</h4>
      {view ? (
        <>
          <p>
            {view.ruleVersion ?? '규정 버전 없음'} · 검수{' '}
            {view.reviewedAt?.slice(0, 10) ?? '미확인'}
            {!view.current && ' · 유효한 실제 규정 판정이 아님'}
          </p>
          {view.sources.map((source) => (
            <p key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            </p>
          ))}
          <p>{view.scopeNotice}</p>
        </>
      ) : (
        <p>
          이전 형식의 결과입니다. 상세 근거와 조건을 받으려면 다시 판정해
          주세요.
        </p>
      )}
      {onSave && (
        <button disabled={saving || saved || !item.confirmed} onClick={onSave}>
          {saved
            ? '도감에 저장됨'
            : saving
              ? '도감에 저장 중…'
              : '확인한 물품을 개인 도감에 저장'}
        </button>
      )}
      {!item.confirmed && (
        <p>저장하려면 물품과 제품 정보를 먼저 확인해 주세요.</p>
      )}
    </article>
  )
}
