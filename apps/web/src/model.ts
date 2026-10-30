// UI-only models. These are not request/response types for contract 2.0.0.
export type Capture = 'overview' | 'label' | 'estimate'
export type Item = {
  id: string
  name: string
  category: string
  model: string
  amount: string
  confirmed: boolean
  origin: 'AI 추정 예시' | '직접 입력'
}
export type Result = {
  itemId: string
  cabin: string
  checked: string
  note: string
  action?: string
  conditions?: string[]
  evidence?: string
  ruleDate?: string
  ruleVersion?: string
}
export type Photo = { id: string; blob: Blob }
export type Card = {
  id: string
  photoIds: string[]
  item: Item
  result: Result
  savedAt: string
  capture: Capture
  airline: string
}
export function editItem(item: Item, change: Partial<Item>): Item {
  return { ...item, ...change, confirmed: false }
}
