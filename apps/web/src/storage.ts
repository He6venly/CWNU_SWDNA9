import type { Card, Photo } from './model'
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('travel-bag-web', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('photos', { keyPath: 'id' })
      request.result.createObjectStore('cards', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error('다른 탭을 닫고 다시 시도해 주세요.'))
  })
async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  act: (tx: IDBTransaction, done: (value: T) => void) => void,
): Promise<T> {
  const db = await database()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    let value: T
    tx.oncomplete = () => {
      db.close()
      resolve(value)
    }
    tx.onerror = tx.onabort = () => {
      db.close()
      reject(tx.error ?? new Error('저장 공간을 확인해 주세요.'))
    }
    act(tx, (result) => {
      value = result
    })
  })
}
export const catalog = {
  savePhotos: (photos: Photo[]) =>
    transaction<void>(['photos'], 'readwrite', (tx, done) => {
      photos.forEach((p) => tx.objectStore('photos').put(p))
      done()
    }),
  saveCards: (cards: Card[], photos: Photo[]) =>
    transaction<void>(['cards', 'photos'], 'readwrite', (tx, done) => {
      photos.forEach((p) => tx.objectStore('photos').put(p))
      cards.forEach((c) => tx.objectStore('cards').put(c))
      done()
    }),
  cards: () =>
    transaction<Card[]>(['cards'], 'readonly', (tx, done) => {
      const r = tx.objectStore('cards').getAll()
      r.onsuccess = () => done(r.result as Card[])
    }),
  photo: (id: string) =>
    transaction<Photo | undefined>(['photos'], 'readonly', (tx, done) => {
      const r = tx.objectStore('photos').get(id)
      r.onsuccess = () => done(r.result as Photo | undefined)
    }),
  remove: (id: string) =>
    transaction<void>(['cards', 'photos'], 'readwrite', (tx, done) => {
      const store = tx.objectStore('cards')
      const target = store.get(id)
      store.delete(id)
      const cards = store.getAll()
      cards.onsuccess = () => {
        const used = new Set(
          (cards.result as Card[]).flatMap((c) => c.photoIds),
        )
        const removed = target.result as Card | undefined
        removed?.photoIds.forEach((photoId) => {
          if (!used.has(photoId)) tx.objectStore('photos').delete(photoId)
        })
      }
      done()
    }),
}
