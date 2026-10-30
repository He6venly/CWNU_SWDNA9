import {
  CatalogCardSchema,
  assertEvaluationItems,
} from '../../../../contract/v2/schemas.ts'
import type { CatalogCard, ItemInfo } from '../../../../contract/v2/types.ts'

export type SavedCard = CatalogCard & { assessedItems?: ItemInfo[] }
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('travel-bag-web-v2', 1)
    r.onupgradeneeded = () => {
      r.result.createObjectStore('cards', { keyPath: 'id' })
      r.result.createObjectStore('photos')
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.onblocked = () =>
      reject(new Error('다른 도감 탭을 닫고 다시 시도해 주세요.'))
  })
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (tx: IDBTransaction, done: (value: T) => void) => void,
): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(['cards', 'photos'], mode)
    let value: T
    tx.oncomplete = () => {
      db.close()
      resolve(value)
    }
    tx.onerror = tx.onabort = () => {
      db.close()
      reject(tx.error ?? new Error('브라우저 저장 공간을 확인해 주세요.'))
    }
    try {
      action(tx, (v) => {
        value = v
      })
    } catch (error) {
      tx.abort()
      reject(error)
    }
  })
}
export function saveCatalogCard(
  value: CatalogCard,
  photos: Record<string, Blob>,
  inventory: ItemInfo[],
) {
  const card = CatalogCardSchema.parse(value)
  assertEvaluationItems(inventory)
  if (
    !card.item.confirmed ||
    card.item.id !== card.result.itemId ||
    card.photoKeys.some((k) => !(photos[k] instanceof Blob))
  )
    throw new Error('물품과 사진 연결을 확인해 주세요.')
  return transaction<void>('readwrite', (tx) => {
    tx.objectStore('cards').add({
      ...card,
      assessedItems: structuredClone(inventory),
    })
    Object.entries(photos).forEach(([key, blob]) =>
      tx.objectStore('photos').add(blob, key),
    )
  })
}
export function listCatalogCards() {
  return transaction<SavedCard[]>('readonly', (tx, done) => {
    const r = tx.objectStore('cards').getAll()
    r.onsuccess = () =>
      done(
        (r.result as SavedCard[]).sort((a, b) =>
          b.savedAt.localeCompare(a.savedAt),
        ),
      )
  })
}
export function getCatalogPhotos(keys: string[]) {
  return transaction<Array<{ key: string; blob: Blob }>>(
    'readonly',
    (tx, done) => {
      const values: Array<{ key: string; blob: Blob }> = []
      done(values)
      keys.forEach((key) => {
        const r = tx.objectStore('photos').get(key)
        r.onsuccess = () => {
          if (r.result instanceof Blob) values.push({ key, blob: r.result })
        }
      })
    },
  )
}
export function deleteCatalogCard(card: CatalogCard) {
  return transaction<void>('readwrite', (tx) => {
    tx.objectStore('cards').delete(card.id)
    card.photoKeys.forEach((key) => tx.objectStore('photos').delete(key))
  })
}
