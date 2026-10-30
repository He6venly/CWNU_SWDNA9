import type { RecognizeRequest, RecognizeResponse } from '../../../../contract/v2/types.ts'
import { api } from './api.ts'
const cache = new Map<string, { at: number; value: RecognizeResponse }>()
let generation = 0
export function clearRecognitionCache() { generation++; cache.clear() }
export async function recognizeCached(input: RecognizeRequest, scope: string, signal: AbortSignal) {
  const current = generation
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)))
  const key = scope + ':' + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
  signal.throwIfAborted()
  const found = cache.get(key)
  if (found && Date.now() - found.at < 30 * 60_000) return structuredClone(found.value)
  const response = await api.recognize(input, signal)
  signal.throwIfAborted()
  if (generation === current) {
    if (cache.size >= 10) cache.delete(cache.keys().next().value!)
    cache.set(key, { at: Date.now(), value: structuredClone(response) })
  }
  return response
}
