import { LIMITS } from '../../../contract/constants.ts'
import { analyzeImagePixels, imageLongEdge, imageQualities } from './image-analysis.ts'
import type { ImageKind } from './image-analysis.ts'

async function prepareImageMain(file: File, signal?: AbortSignal, maxBytes: number = LIMITS.clientImageBytes, kind: ImageKind = 'overview') {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPEG·PNG·WebP 사진을 선택해 주세요.')
  if (file.size > 20 * 1024 * 1024) throw new Error('원본 사진은 20MiB 이하로 선택해 주세요.')
  signal?.throwIfAborted()
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file) } catch { throw new Error('사진을 읽지 못했습니다. JPEG·PNG·WebP로 변환 후 다시 선택해 주세요.') }
  try {
    signal?.throwIfAborted()
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('사진 해상도가 너무 큽니다. 해상도를 낮춰 다시 선택해 주세요.')
    const sampleScale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height))
    const sample = document.createElement('canvas')
    sample.width = Math.max(1, Math.round(bitmap.width * sampleScale)); sample.height = Math.max(1, Math.round(bitmap.height * sampleScale))
    const sampleContext = sample.getContext('2d', { willReadFrequently: true })
    if (!sampleContext) throw new Error('이 브라우저에서 사진 분석을 지원하지 않습니다.')
    sampleContext.drawImage(bitmap, 0, 0, sample.width, sample.height)
    const analysis = analyzeImagePixels(sampleContext.getImageData(0, 0, sample.width, sample.height).data, sample.width, sample.height, kind)
    const source = analysis.crop ? {
      x: Math.round(analysis.crop.x * bitmap.width), y: Math.round(analysis.crop.y * bitmap.height),
      width: Math.round(analysis.crop.width * bitmap.width), height: Math.round(analysis.crop.height * bitmap.height),
    } : { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
    const scale = Math.min(1, imageLongEdge(kind, LIMITS.imageLongEdge) / Math.max(source.width, source.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('이 브라우저에서 사진 변환을 지원하지 않습니다.')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height)
    for (const quality of imageQualities(kind)) {
      signal?.throwIfAborted()
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= maxBytes) {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        signal?.throwIfAborted()
        let binary = ''
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
        return { image: { mimeType: 'image/jpeg' as const, base64: btoa(binary) }, preview: URL.createObjectURL(blob), bytes: blob.size, warnings: analysis.warnings, cropApplied: Boolean(analysis.crop) }
      }
    }
    throw new Error('사진을 전송 가능한 크기로 줄이지 못했습니다. 더 작은 사진을 선택해 주세요.')
  } finally { bitmap.close() }
}

export async function prepareImage(file: File, signal?: AbortSignal, maxBytes: number = LIMITS.clientImageBytes, kind: ImageKind = 'overview') {
  if (!('OffscreenCanvas' in globalThis) || !('Worker' in globalThis)) return prepareImageMain(file, signal, maxBytes, kind)
  signal?.throwIfAborted()
  const worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' })
  try {
    const result = await new Promise<{ blob: Blob; warnings: string[]; cropApplied: boolean }>((resolve, reject) => {
      const abort = () => reject(new DOMException('취소됨', 'AbortError'))
      signal?.addEventListener('abort', abort, { once: true })
      worker.onmessage = event => {
        signal?.removeEventListener('abort', abort)
        if (event.data.error) reject(new Error(event.data.error))
        else resolve(event.data)
      }
      worker.onerror = () => { signal?.removeEventListener('abort', abort); reject(new Error('사진 변환에 실패했습니다.')) }
      worker.postMessage({ file, maxBytes, longEdge: imageLongEdge(kind, LIMITS.imageLongEdge), kind })
    })
    signal?.throwIfAborted()
    const blob = result.blob
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    return { image: { mimeType: 'image/jpeg' as const, base64: btoa(binary) }, preview: URL.createObjectURL(blob), bytes: blob.size, warnings: result.warnings, cropApplied: result.cropApplied }
  } finally { worker.terminate() }
}
