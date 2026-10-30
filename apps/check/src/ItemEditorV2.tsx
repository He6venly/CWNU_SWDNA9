import { CATEGORY_IDS, FIELD_KEYS } from '../../../contract/v2/constants.ts'
import { labels } from '../../../contract/v2/labels.ts'
import type { ItemInfo } from '../../../contract/v2/types.ts'

export default function ItemEditorV2({ item, onChange }: { item: ItemInfo; onChange: (item: ItemInfo) => void }) {
  const edit = (patch: Partial<ItemInfo>) => onChange({ ...item, ...patch, confirmed: false, userEdited: true })
  return <fieldset><legend>{item.name}</legend>
    <p>식별: {item.identification === 'ai_estimated' ? 'AI 추정 (시연)' : '라벨 판독 (시연)'} · 신뢰도 {item.confidence}</p>
    <label>물품명<input value={item.name} maxLength={120} onChange={e => edit({ name: e.target.value })} /></label>
    <label>카테고리<select value={item.categoryId ?? ''} onChange={e => edit({ categoryId: (e.target.value || null) as ItemInfo['categoryId'] })}>
      <option value="">미확인</option>{CATEGORY_IDS.map(id => <option value={id} key={id}>{id}</option>)}
    </select></label>
    {FIELD_KEYS.map(field => <label key={field}>{labels.fields[field]}<input type={field === 'modelName' || field === 'brand' ? 'text' : 'number'}
      value={item.fields[field] ?? ''} step={field === 'count' ? 1 : 'any'} onChange={e => {
        const value = e.target.value === '' ? null : field === 'modelName' || field === 'brand' ? e.target.value : Number(e.target.value)
        const fields = { ...item.fields, [field]: value }, fieldSources = { ...item.fieldSources }
        if (value === null) delete fieldSources[field]
        else fieldSources[field] = { source: 'user', confirmed: true, ...(field === 'volts' ? { voltageType: 'unknown' as const } : {}) }
        edit({ fields, fieldSources, unreadFields: FIELD_KEYS.filter(key => fields[key] === null) })
      }} />
      <small>출처: {item.fieldSources[field] ? labels.sources[item.fieldSources[field]!.source] : '미확인'}{item.fieldSources[field]?.confirmed ? ' · 확인됨' : ''}</small>
    </label>)}
    {item.fields.volts !== null && <label>전압 종류<select value={item.fieldSources.volts?.voltageType ?? 'unknown'} onChange={e => {
      edit({ fieldSources: { ...item.fieldSources, volts: { source: 'user', confirmed: true, voltageType: e.target.value as 'nominal' | 'output' | 'unknown' } } })
    }}><option value="unknown">미확인</option><option value="nominal">배터리 공칭 전압</option><option value="output">USB 등 출력 전압</option></select></label>}
    <label><input type="checkbox" checked={item.confirmed} onChange={e => onChange({
      ...item, confirmed: e.target.checked,
      fieldSources: Object.fromEntries(Object.entries(item.fieldSources).map(([key, source]) => [key, { ...source, confirmed: source.source === 'user' || e.target.checked }])),
    })} />물품과 표시된 제품 정보를 확인했습니다.</label>
  </fieldset>
}
