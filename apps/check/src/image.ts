import { LIMITS } from '../../../contract/constants.ts'

export async function prepareImage(file: File, signal?: AbortSignal) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPEG·PNG·WebP 사진을 선택해 주세요.')
  if (file.size > 20 * 1024 * 1024) throw new Error('원본 사진은 20MiB 이하로 선택해 주세요.')
  signal?.throwIfAborted()
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file) } catch { throw new Error('사진을 읽지 못했습니다. JPEG·PNG·WebP로 변환 후 다시 선택해 주세요.') }
  try {
    signal?.throwIfAborted()
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('사진 해상도가 너무 큽니다. 해상도를 낮춰 다시 선택해 주세요.')
    const scale = Math.min(1, LIMITS.imageLongEdge / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('이 브라우저에서 사진 변환을 지원하지 않습니다.')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.7, 0.5]) {
      signal?.throwIfAborted()
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= LIMITS.clientImageBytes) {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        signal?.throwIfAborted()
        let binary = ''
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
        return { image: { mimeType: 'image/jpeg' as const, base64: btoa(binary) }, preview: URL.createObjectURL(blob), bytes: blob.size }
      }
    }
    throw new Error('사진을 1MiB 이하로 줄이지 못했습니다. 더 작은 사진을 선택해 주세요.')
  } finally { bitmap.close() }
}
