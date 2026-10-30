import { z } from 'zod'
import { useState } from 'react'
import { detailLabels, detailOptionLabels, detailSchemas, ItemDetailsSchema } from '../../../contract/v2/item-details.ts'
import type { ItemDetails } from '../../../contract/v2/item-details.ts'

export default function DetailsEditor({ value, onChange }: { value: ItemDetails; onChange: (value: ItemDetails) => void }) {
  const [error, setError] = useState('')
  function change(key: string, next: unknown) {
    const parsed = ItemDetailsSchema.safeParse({ ...value, [key]: next, confirmed: false })
    if (!parsed.success) { setError('입력 범위를 확인해 주세요. 주류 도수는 0~100입니다.'); return }
    setError(''); onChange(parsed.data)
  }
  return <fieldset><legend>추가 제품·안전 정보 (직접 확인)</legend>
    {Object.entries(detailSchemas[value.type].shape).map(([key, schema]) => {
      if (!(schema instanceof z.ZodNullable)) return null
      const label = detailLabels[key as keyof typeof detailLabels], inner = schema.unwrap()
      const current = (value as unknown as Record<string, unknown>)[key]
      if (inner instanceof z.ZodNumber) return <label key={key}>{label}<input type="number" min={0} max={100} step="any" value={current === null ? '' : String(current)} onChange={e => change(key, e.target.value === '' ? null : Number(e.target.value))} /></label>
      const choices = inner instanceof z.ZodEnum ? inner.options : ['true', 'false']
      return <label key={key}>{label}<select value={current === null ? '' : String(current)} onChange={e => change(key, e.target.value === '' ? null : inner instanceof z.ZodBoolean ? e.target.value === 'true' : e.target.value)}>
        <option value="">미확인</option>{choices.map(choice => <option key={choice} value={choice}>{choice === 'true' ? '예' : choice === 'false' ? '아니요' : detailOptionLabels[choice]}</option>)}
      </select></label>
    })}
    <p>사진에서 알 수 없는 안전 상태·재질·전원 방식은 추측하지 말고 제품·설명서로 확인해 주세요. 아래 물품 확인을 누르기 전에는 확정하지 않습니다.</p>
    {error && <p role="alert">{error}</p>}
  </fieldset>
}
