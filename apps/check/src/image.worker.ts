import { analyzeImagePixels, imageQualities } from './image-analysis.ts'
import type { ImageKind } from './image-analysis.ts'

self.onmessage = async (event: MessageEvent<{ file: File; maxBytes: number; longEdge: number; kind: ImageKind }>) => {
  const { file, maxBytes, longEdge, kind } = event.data
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPEG·PNG·WebP 사진을 선택해 주세요.')
    if (file.size > 20 * 1024 * 1024) throw new Error('원본 사진은 20MiB 이하로 선택해 주세요.')
    const bitmap = await createImageBitmap(file)
    try {
      if (bitmap.width * bitmap.height > 40_000_000) throw new Error('사진 해상도가 너무 큽니다.')
      const sampleScale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height))
      const sample = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * sampleScale)), Math.max(1, Math.round(bitmap.height * sampleScale)))
      const sampleContext = sample.getContext('2d', { willReadFrequently: true })
      if (!sampleContext) throw new Error('사진 분석을 지원하지 않습니다.')
      sampleContext.drawImage(bitmap, 0, 0, sample.width, sample.height)
      const analysis = analyzeImagePixels(sampleContext.getImageData(0, 0, sample.width, sample.height).data, sample.width, sample.height, kind)
      const source = analysis.crop ? {
        x: Math.round(analysis.crop.x * bitmap.width), y: Math.round(analysis.crop.y * bitmap.height),
        width: Math.round(analysis.crop.width * bitmap.width), height: Math.round(analysis.crop.height * bitmap.height),
      } : { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
      const scale = Math.min(1, longEdge / Math.max(source.width, source.height))
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(source.width * scale)), Math.max(1, Math.round(source.height * scale)))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('사진 변환을 지원하지 않습니다.')
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height)
      for (const quality of imageQualities(kind)) {
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
        if (blob.size <= maxBytes) { self.postMessage({ blob, warnings: analysis.warnings, cropApplied: Boolean(analysis.crop) }); return }
      }
      throw new Error('사진을 전송 가능한 크기로 줄이지 못했습니다.')
    } finally { bitmap.close() }
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : '사진 변환 실패' }) }
}
