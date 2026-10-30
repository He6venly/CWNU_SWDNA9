import type { z } from 'zod'
import { assertItemSemantics } from '../../../contract/schemas.ts'
import { LIMITS } from '../../../contract/constants.ts'
import type { DetectedItem } from '../../../contract/types.ts'
import { HttpError, invalidRequest, payloadTooLarge } from './errors.ts'

export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'application/json 형식으로 요청해 주세요.')
  }
  const length = request.headers.get('Content-Length')
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw payloadTooLarge()
  if (!request.body) throw invalidRequest()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new HttpError(408, 'REQUEST_TIMEOUT', '요청 수신 시간이 초과되었습니다.')), 5000)
  })
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), timeout])
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > maxBytes) throw payloadTooLarge()
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown } catch { throw invalidRequest() }
  } finally {
    clearTimeout(timer)
    void reader.cancel().catch(() => {})
  }
}
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    if (result.error.issues.some(issue => issue.code === 'too_big' && issue.path.join('.') === 'image.base64')) throw payloadTooLarge()
    throw invalidRequest()
  }
  return result.data
}
export function checkItems(items: DetectedItem[]) {
  if (new Set(items.map(i => i.id)).size !== items.length) throw invalidRequest()
  try { items.forEach(assertItemSemantics) } catch { throw invalidRequest() }
}
export function checkImage(image: { base64: string; mimeType: string }) {
  const bytes = Buffer.from(image.base64, 'base64')
  if (bytes.length > LIMITS.imageBytes) throw payloadTooLarge()
  if (bytes.toString('base64') !== image.base64) throw invalidRequest()
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  const matches = (image.mimeType === 'image/png' && png) || (image.mimeType === 'image/jpeg' && jpeg) || (image.mimeType === 'image/webp' && webp)
  if (!matches) throw invalidRequest()
}
