import { assertEvaluationItems, CatalogCardSchema } from './schemas.ts'
import type { CatalogCard } from './types.ts'

// 사진은 서버로 전송하지 않고 브라우저 IndexedDB에만 보관. 프론트에서도 재사용 가능.
const DATABASE = 'travel-carry-reference-v1'
function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('cards', { keyPath: 'id' }); db.createObjectStore('photos')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('물품 기록 저장소를 열지 못했습니다.'))
    request.onblocked = () => reject(new Error('다른 탭의 여행 기록을 닫은 뒤 다시 시도해 주세요.'))
  })
}
async function transaction<T>(mode: IDBTransactionMode, action: (tx: IDBTransaction, setResult: (value: T) => void) => void): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      let value: T
      const tx = db.transaction(['cards', 'photos'], mode)
      tx.oncomplete = () => resolve(value)
      tx.onabort = () => reject(tx.error ?? new Error('물품 기록 처리에 실패했습니다. 저장 공간을 확인해 주세요.'))
      tx.onerror = () => reject(tx.error ?? new Error('물품 기록 처리에 실패했습니다.'))
      try { action(tx, result => { value = result }) } catch (error) { tx.abort(); reject(error) }
    })
  } finally { db.close() }
}
export function saveCatalogCard(value: CatalogCard, photos: Record<string, Blob>) {
  const card = CatalogCardSchema.parse(value)
  assertEvaluationItems([card.item])
  if (!card.item.confirmed || card.item.id !== card.result.itemId || new Set(card.photoKeys).size !== card.photoKeys.length || card.photoKeys.some(key => !(photos[key] instanceof Blob))) throw new Error('확인된 물품·판정·사진의 연결을 확인해 주세요.')
  return transaction<void>('readwrite', tx => {
    tx.objectStore('cards').add(card)
    for (const key of card.photoKeys) tx.objectStore('photos').add(photos[key], key)
  })
}
export function listCatalogCards() {
  return transaction<CatalogCard[]>('readonly', (tx, done) => {
    const request = tx.objectStore('cards').getAll()
    request.onsuccess = () => done(request.result.flatMap(value => {
      const parsed = CatalogCardSchema.safeParse(value)
      return parsed.success ? [parsed.data] : []
    }).sort((a, b) => b.savedAt.localeCompare(a.savedAt)))
  })
}
export function getCatalogPhotos(keys: string[]) {
  return transaction<Array<{ key: string; blob: Blob }>>('readonly', (tx, done) => {
    const values: Array<{ key: string; blob: Blob }> = []; done(values)
    for (const key of keys) {
      const request = tx.objectStore('photos').get(key)
      request.onsuccess = () => { if (request.result instanceof Blob) values.push({ key, blob: request.result }) }
    }
  })
}
export function deleteCatalogCard(card: CatalogCard) {
  return transaction<void>('readwrite', tx => {
    tx.objectStore('cards').delete(card.id)
    for (const key of card.photoKeys) tx.objectStore('photos').delete(key)
  })
}
