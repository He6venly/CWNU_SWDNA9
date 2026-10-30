import { useState } from 'react'
import PhotoPicker from './PhotoPicker.tsx'
import type { Photo } from './PhotoPicker.tsx'
import type { ItemInfo } from '../../../../contract/v2/types.ts'
export default function LabelSupplement({ item, busy, onAnalyze }: { item: ItemInfo; busy: boolean; onAnalyze: (photos: Photo[]) => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]), [working, setWorking] = useState(false), [message, setMessage] = useState('')
  return <details><summary>이 물품의 라벨 사진으로 사양 보완</summary>
    <p>같은 제품의 라벨을 선택해 주세요. 기존 목록과 입력값은 유지하고 빈 사양만 채웁니다.</p>
    <fieldset disabled={busy}><PhotoPicker maxImages={3} defaultKind="label" onStart={() => setPhotos([])}
      onChange={values => { const prefix = 'label-' + crypto.randomUUID(); setPhotos(values.map((photo, index) => ({ ...photo, id: prefix + '-' + index }))) }}
      onWorking={setWorking} onMessage={setMessage} />
      {photos.map(photo => <img className="photo" src={photo.preview} alt={`${item.name} 보완 라벨`} key={photo.id} />)}
      <button disabled={working || !photos.length} onClick={() => onAnalyze(photos)}>이 물품 라벨 분석</button>
    </fieldset><p role="status">{message}</p></details>
}
