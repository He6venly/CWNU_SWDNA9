import { useEffect, useRef, useState } from 'react'
import type { ItemInfo } from '../../../contract/v2/types.ts'
import type { Photo } from './PhotoPicker.tsx'
import UiIcon from './UiIcon.tsx'

type Album = { id: string; title: string; date: string; memo: string; items: ItemInfo[]; photos: Blob[]; checked: string[] }
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('travel-albums-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('albums', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('다른 탭을 닫고 다시 시도해 주세요.'))
  })
}
async function access<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database()
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('albums', mode), request = operation(tx.objectStore('albums'))
    tx.oncomplete = () => resolve(request.result)
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('앨범 저장에 실패했습니다.'))
  }) } finally { db.close() }
}
function AlbumPhoto({ photo }: { photo: Blob }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(photo)
    const element = image.current
    if (element) element.src = url
    return () => { element?.removeAttribute('src'); URL.revokeObjectURL(url) }
  }, [photo])
  return <img ref={image} className="photo" alt="여행 짐 사진" />
}
function AlbumView({ album, update, remove, restore }: { album: Album; update: (album: Album) => void; remove: () => void; restore: () => void }) {
  return <article className="album-card"><header><div><small>MY TRIP</small><h3>{album.title}</h3><p>{album.date || '날짜 미정'}</p></div><span aria-hidden="true">✈</span></header>{album.photos.map((photo, index) => <AlbumPhoto key={index} photo={photo} />)}
    <label>메모<textarea value={album.memo} onChange={e => update({ ...album, memo: e.target.value })} /></label>
    <ul>{album.items.map(item => <li key={item.id}><label><input type="checkbox" checked={album.checked.includes(item.id)} onChange={e => update({ ...album, checked: e.target.checked ? [...album.checked, item.id] : album.checked.filter(id => id !== item.id) })} />{item.name}</label></li>)}</ul>
    <button className="secondary-action" onClick={restore}>다음 여행에 목록 복사</button><button className="danger-action" onClick={remove}>앨범 삭제</button></article>
}
export default function TravelAlbum({ items, photos, onRestore, readOnly = false }: { items: ItemInfo[]; photos: Photo[]; onRestore: (items: ItemInfo[]) => void; readOnly?: boolean }) {
  const [albums, setAlbums] = useState<Album[]>([]), [title, setTitle] = useState(''), [date, setDate] = useState(''), [message, setMessage] = useState('')
  async function refresh() { try { setAlbums(await access('readonly', store => store.getAll())) } catch { setMessage('앨범을 불러오지 못했습니다.') } }
  useEffect(() => {
    let active = true
    void access<Album[]>('readonly', store => store.getAll()).then(values => {
      if (active) setAlbums(values)
    }).catch(() => { if (active) setMessage('앨범을 불러오지 못했습니다.') })
    return () => { active = false }
  }, [])
  async function update(album: Album) { try { await access('readwrite', store => store.put(album)); await refresh() } catch { setMessage('앨범을 저장하지 못했습니다.') } }
  async function save() {
    if (!title.trim() || !items.length || items.some(item => !item.confirmed)) { setMessage('여행 제목과 확인된 물품 목록이 필요합니다.'); return }
    const blobs = photos.map(photo => new Blob([Uint8Array.from(atob(photo.base64), c => c.charCodeAt(0))], { type: photo.mimeType }))
    await update({ id: crypto.randomUUID(), title: title.trim(), date, memo: '', items: structuredClone(items), photos: blobs, checked: [] }); setTitle('')
  }
  return <section id="album" className="card-section album-section"><div className="section-heading"><UiIcon name="album" /><div><p className="eyebrow">LEGACY TRIPS</p><h2>이전 여행 기록</h2><p>기존 버전에서 저장한 여행을 그대로 보존합니다.</p></div></div>
    {!readOnly && <div className="album-form"><label className="form-field">여행 제목<input placeholder="예: 오사카 가을 여행" value={title} onChange={e => setTitle(e.target.value)} /></label><label className="form-field">여행 날짜<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <button className="primary-action" onClick={() => void save()}>확인한 목록 전체 저장</button></div>}<p role="status">{message}</p>
    <div className="album-grid">{albums.map(album => <AlbumView key={album.id} album={album} update={value => { setAlbums(current => current.map(entry => entry.id === value.id ? value : entry)); void update(value) }} remove={() => void access('readwrite', store => store.delete(album.id)).then(refresh).catch(() => setMessage('삭제하지 못했습니다.'))} restore={() => onRestore(structuredClone(album.items))} />)}</div>
  </section>
}
