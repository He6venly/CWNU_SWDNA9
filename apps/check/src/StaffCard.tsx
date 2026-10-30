import { useEffect, useRef, useState } from 'react'
import type { CatalogCard } from '../../../contract/v2/types.ts'
import { getCatalogPhotos } from '../../../contract/v2/catalog-store.ts'
import { FIELD_KEYS } from '../../../contract/v2/constants.ts'
import { labels } from '../../../contract/v2/labels.ts'

const englishFields = { brand: 'Brand', modelName: 'Model', wh: 'Energy (Wh)', mah: 'Capacity (mAh)', volts: 'Voltage (V)', ml: 'Container (mL)', count: 'Quantity' }
const englishTypes = { 'power-bank': 'Power bank', 'cordless-iron': 'Hair-styling device', liquid: 'Liquid / gel', lighter: 'Lighter / matches', electronics: 'Portable electronic device', 'general-items': 'General belongings' }
export function useCatalogPhotos(keys: string[]) {
  const [photos, setPhotos] = useState<string[]>([]), [error, setError] = useState('')
  const signature = JSON.stringify(keys)
  useEffect(() => {
    let active = true; const urls: string[] = []
    setPhotos([]); setError('')
    void getCatalogPhotos(JSON.parse(signature)).then(values => {
      if (!active) return
      urls.push(...values.map(value => URL.createObjectURL(value.blob))); setPhotos([...urls])
      if (values.length !== JSON.parse(signature).length) setError('일부 저장 사진을 찾을 수 없습니다.')
    }).catch(() => { if (active) setError('저장 사진을 읽지 못했습니다.') })
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [signature])
  return { photos, error }
}
export default function StaffCard({ card, onClose, currentRuleVersion, rulesCurrent }: { card: CatalogCard; onClose: () => void; currentRuleVersion: string | null; rulesCurrent: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { photos, error } = useCatalogPhotos(card.photoKeys)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  const item = card.item, result = card.result, view = result.presentation
  const expired = !rulesCurrent || !view?.current || !view.reviewBy || Date.now() >= Date.parse(view.reviewBy) || card.ruleVersion !== currentRuleVersion
  return <dialog ref={dialog} className="staff-dialog" aria-labelledby="staff-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="staff-toolbar"><button onClick={onClose}>닫기 / Close</button><button onClick={() => window.print()}>인쇄 / PDF 저장</button></div>
    <h2 id="staff-title">물품 참고 정보 <small>Item reference</small></h2>
    {card.meta.isDemoRules || result.isDemo ? <p className="staff-warning">시연 데이터 / Demo data</p> : expired && <p className="staff-warning">저장 당시의 결과입니다. 최신 규정 재확인 필요 / Saved assessment — recheck current rules.</p>}
    {item.identification !== 'manual' && card.meta.isDemoRecognition && <p>사진 인식은 시연 데이터였으며 실제 물품 일치 여부는 사용자 확인 대상입니다. / Demo recognition; verify the actual item.</p>}
    <h3>{item.name}</h3><p>{item.categoryId ? englishTypes[item.categoryId] : 'Item type not confirmed'}</p>
    {photos.map((photo, index) => <img key={photo} className="staff-photo" src={photo} alt={`저장한 물품 사진 ${index + 1} / Saved item photo`} />)}
    {!card.photoKeys.length && <p>등록 사진 없음 · 직접 입력 / No photo — manually entered</p>}{error && <p role="alert">{error}</p>}
    <dl className="staff-specs">{FIELD_KEYS.filter(field => item.fields[field] !== null).map(field => <div key={field}><dt>{labels.fields[field]} / {englishFields[field]}</dt><dd>{item.fields[field]} <small>{item.fieldSources[field]?.confirmed ? '사용자 확인 / User-confirmed' : '미확인 / Unconfirmed'}</small></dd></div>)}</dl>
    {result.derivedFields.wh && <p>계산 전력량 / Calculated energy: {result.derivedFields.wh.displayValue}Wh</p>}
    <div className="verdict-grid"><div><strong>기내 / Carry-on</strong><p>{labels.verdicts[result.cabin.verdict]}<br />{result.cabin.verdict}</p></div><div><strong>위탁 / Checked</strong><p>{labels.verdicts[result.checked.verdict]}<br />{result.checked.verdict}</p></div></div>
    <p>권장 조치 / Recommended action: {labels.actions[result.action]}<br />{({ PUT_IN_CABIN: 'Place in carry-on baggage', PUT_IN_CHECKED: 'Place in checked baggage', CHECK_CONDITIONS: 'Review conditions and outstanding information', LEAVE_BEHIND: 'Do not bring this item' })[result.action]}</p><p>{view?.staffSummaryEn ?? 'Saved reference only. Reassess to obtain detailed conditions.'}</p>
    {view && <ul>{view.conditions.map(entry => <li key={`${entry.code}-${entry.appliesTo}`}><strong>{entry.appliesTo === 'cabin' ? '기내 / Carry-on' : entry.appliesTo === 'checked' ? '위탁 / Checked' : '공통 / Both'}</strong><br />{entry.text}<br /><span lang="en">{entry.textEn}</span></li>)}</ul>}
    {!!view?.requiredInfo.length && <div className="staff-warning"><strong>추가 확인 필요 / Further information required</strong>{view.requiredInfo.map(entry => <p key={entry.key}>{entry.text}<br />{entry.textEn}</p>)}</div>}
    <p>{card.airline.name} · {labels.flightTypes[card.flightType]} · 여행자 1명 / One passenger</p>
    <p>판정 기준 / Rule version: {card.ruleVersion ?? '미확인 / Unknown'}<br />규정 검수 / Rule review: {view?.reviewedAt?.slice(0, 10) ?? '미확인 / Unknown'}<br />판정 시각 / Assessed: {card.evaluatedAt}</p>
    {card.assessmentContext && <p>판정 당시 {card.assessmentContext.evaluatedItemIds.length}개 물품 카드 합산 기준 / Quantities assessed with {card.assessmentContext.evaluatedItemIds.length} item entries.{!card.assessmentContext.inventoryComplete && ' 부분 목록 / Partial inventory.'}</p>}
    {view?.sources.map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></p>)}
    <p>{labels.referenceNotice}</p><p lang="en">For reference only. This is not a permit or clearance certificate. Final decisions rest with airline, security and customs staff.</p>
  </dialog>
}
