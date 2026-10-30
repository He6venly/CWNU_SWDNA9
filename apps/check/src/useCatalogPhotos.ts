import { useEffect, useState } from 'react'
import { getCatalogPhotos } from '../../../contract/v2/catalog-store.ts'

export function useCatalogPhotos(keys: string[]) {
  const signature = JSON.stringify(keys)
  const [loaded, setLoaded] = useState({ signature: '', photos: [] as string[], error: '' })
  useEffect(() => {
    let active = true
    const urls: string[] = []
    const photoKeys: string[] = JSON.parse(signature)
    void getCatalogPhotos(photoKeys).then(values => {
      if (!active) return
      urls.push(...values.map(value => URL.createObjectURL(value.blob)))
      setLoaded({ signature, photos: [...urls], error: values.length === photoKeys.length ? '' : '일부 저장 사진을 찾을 수 없습니다.' })
    }).catch(() => { if (active) setLoaded({ signature, photos: [], error: '저장 사진을 읽지 못했습니다.' }) })
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [signature])
  return loaded.signature === signature ? loaded : { photos: [], error: '' }
}
