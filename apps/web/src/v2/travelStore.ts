import type { FlightType, ItemInfo } from '../../../../contract/v2/types.ts'
import { normalizeCountry } from './travelCountries.ts'

const DATABASE = 'travel-workspace-v1'
const STORE = 'travels'
const ACTIVE_TRAVEL_KEY = 'active-travel-id'
const DESTINATION_REQUIRED_MIGRATION_KEY = 'destination-required-migration-v1'

export type TravelRecord = {
  id: string
  title: string
  date: string
  origin: string
  destination: string
  airlineId: string
  flightType: FlightType
  inventoryComplete: boolean
  items: ItemInfo[]
  packedItemIds: string[]
  coverPhoto?: Blob
  status: 'draft' | 'assessed'
  createdAt: string
  updatedAt: string
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error('다른 탭을 닫고 다시 시도해 주세요.'))
  })
}

async function access<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = operation(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error('여행 저장에 실패했습니다.'))
    })
  } finally {
    db.close()
  }
}

export async function listTravels(): Promise<TravelRecord[]> {
  const values = await access<TravelRecord[]>('readonly', (store) =>
    store.getAll(),
  )
  const normalized = values.map((travel) => ({ ...travel, origin: normalizeCountry(travel.origin), destination: normalizeCountry(travel.destination, '') }))
  if (localStorage.getItem(DESTINATION_REQUIRED_MIGRATION_KEY) !== '1') {
    const migrated = normalized.map((travel) => travel.flightType === 'domestic' && travel.destination === 'KR' ? { ...travel, destination: '' } : travel)
    await Promise.all(migrated.filter((travel, index) => travel.destination !== normalized[index]!.destination).map((travel) => access('readwrite', (store) => store.put(travel))))
    localStorage.setItem(DESTINATION_REQUIRED_MIGRATION_KEY, '1')
    return migrated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  return normalized.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getTravel(id: string): Promise<TravelRecord | undefined> {
  return access('readonly', (store) => store.get(id))
}

export function saveTravel(travel: TravelRecord): Promise<IDBValidKey> {
  localStorage.setItem(ACTIVE_TRAVEL_KEY, travel.id)
  return access('readwrite', (store) => store.put(travel))
}

export function deleteTravel(id: string): Promise<undefined> {
  if (localStorage.getItem(ACTIVE_TRAVEL_KEY) === id)
    localStorage.removeItem(ACTIVE_TRAVEL_KEY)
  return access('readwrite', (store) => store.delete(id))
}

export function activeTravelId(): string | null {
  return localStorage.getItem(ACTIVE_TRAVEL_KEY)
}

export function setActiveTravelId(id: string): void {
  localStorage.setItem(ACTIVE_TRAVEL_KEY, id)
}
