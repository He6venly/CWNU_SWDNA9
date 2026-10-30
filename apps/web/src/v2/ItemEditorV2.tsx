import { CATEGORY_IDS, FIELD_KEYS } from '../../../../contract/v2/constants.ts'
import { labels } from '../../../../contract/v2/labels.ts'
import type { ItemInfo } from '../../../../contract/v2/types.ts'
import { emptyDetails } from '../../../../contract/v2/item-details.ts'
import DetailsEditor from './DetailsEditor.tsx'

export default function ItemEditorV2({
  item,
  onChange,
  isDemo = true,
}: {
  item: ItemInfo
  onChange: (item: ItemInfo) => void
  isDemo?: boolean
}) {
  const edit = (patch: Partial<ItemInfo>) =>
    onChange({ ...item, ...patch, confirmed: false, userEdited: true })
  return (
    <fieldset className="item-editor">
      <legend>{item.name}</legend>
      <p>
        식별:{' '}
        {item.identification === 'manual'
          ? '사진 없이 직접 입력'
          : `${item.identification === 'ai_estimated' ? 'AI 추정' : '라벨 판독'}${isDemo ? ' (시연)' : ''} · 신뢰도 ${item.confidence}`}
      </p>
      <label>
        물품명
        <input
          value={item.name}
          maxLength={120}
          onChange={(e) => edit({ name: e.target.value })}
        />
      </label>
      {item.estimate && (
        <p>
          외형 추정 근거: {item.estimate.basis} · 후보:{' '}
          {item.estimate.candidates
            .map((candidate) => candidate.name)
            .join(', ')}
        </p>
      )}
      <label>
        카테고리
        <select
          value={item.categoryId ?? ''}
          onChange={(e) => {
            const categoryId = (e.target.value ||
              null) as ItemInfo['categoryId']
            edit({
              categoryId,
              details: categoryId ? emptyDetails(categoryId) : undefined,
            })
          }}
        >
          <option value="">미확인</option>
          {CATEGORY_IDS.map((id) => (
            <option value={id} key={id}>
              {
                {
                  'power-bank': '보조배터리',
                  'cordless-iron': '고데기',
                  liquid: '액체·젤류',
                  lighter: '라이터',
                  electronics: '전자기기',
                  'general-items': '일반 물품',
                }[id]
              }
            </option>
          ))}
        </select>
      </label>
      {FIELD_KEYS.filter(
        (field) =>
          item.identification !== 'manual' ||
          (item.categoryId === 'liquid'
            ? ['brand', 'modelName', 'ml', 'count']
            : ['brand', 'modelName', 'wh', 'mah', 'volts', 'count']
          ).includes(field),
      ).map((field) => (
        <label key={field}>
          {labels.fields[field]}
          <input
            aria-label={labels.fields[field]}
            type={
              field === 'modelName' || field === 'brand' ? 'text' : 'number'
            }
            value={item.fields[field] ?? ''}
            step={field === 'count' ? 1 : 'any'}
            onChange={(e) => {
              const value =
                e.target.value === ''
                  ? null
                  : field === 'modelName' || field === 'brand'
                    ? e.target.value
                    : Number(e.target.value)
              const fields = { ...item.fields, [field]: value },
                fieldSources = { ...item.fieldSources }
              if (
                (field === 'mah' || field === 'volts') &&
                fieldSources.wh?.source === 'calculated'
              ) {
                fields.wh = null
                delete fieldSources.wh
              }
              if (value === null) delete fieldSources[field]
              else
                fieldSources[field] = {
                  source: 'user',
                  confirmed: true,
                  ...(field === 'volts'
                    ? { voltageType: 'unknown' as const }
                    : {}),
                }
              edit({
                fields,
                fieldSources,
                unreadFields: FIELD_KEYS.filter((key) => fields[key] === null),
              })
            }}
          />
          <small>
            출처:{' '}
            {item.fieldSources[field]
              ? labels.sources[item.fieldSources[field]!.source]
              : '미확인'}
            {item.fieldSources[field]?.confirmed ? ' · 확인됨' : ''}
          </small>
        </label>
      ))}
      {item.fields.volts !== null && (
        <label>
          전압 종류
          <select
            value={item.fieldSources.volts?.voltageType ?? 'unknown'}
            onChange={(e) => {
              const fields = { ...item.fields },
                fieldSources = {
                  ...item.fieldSources,
                  volts: {
                    source: 'user' as const,
                    confirmed: true,
                    voltageType: e.target.value as
                      'nominal' | 'output' | 'unknown',
                  },
                }
              if (fieldSources.wh?.source === 'calculated') {
                fields.wh = null
                delete fieldSources.wh
              }
              edit({
                fields,
                fieldSources,
                unreadFields: FIELD_KEYS.filter((key) => fields[key] === null),
              })
            }}
          >
            <option value="unknown">미확인</option>
            <option value="nominal">배터리 공칭 전압</option>
            <option value="output">USB 등 출력 전압</option>
          </select>
        </label>
      )}
      {item.categoryId && (
        <DetailsEditor
          value={item.details ?? emptyDetails(item.categoryId)}
          onChange={(details) => edit({ details })}
        />
      )}
      <label>
        <input
          type="checkbox"
          checked={item.confirmed}
          onChange={(e) =>
            onChange({
              ...item,
              confirmed: e.target.checked,
              details: item.categoryId
                ? {
                    ...(item.details ?? emptyDetails(item.categoryId)),
                    confirmed: e.target.checked,
                  }
                : undefined,
              fieldSources: Object.fromEntries(
                Object.entries(item.fieldSources).map(([key, source]) => [
                  key,
                  {
                    ...source,
                    confirmed: source.source === 'user' || e.target.checked,
                  },
                ]),
              ),
            })
          }
        />
        물품과 표시된 제품 정보를 확인했습니다.
      </label>
    </fieldset>
  )
}
