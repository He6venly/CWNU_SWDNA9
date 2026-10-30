export type ImageKind = 'overview' | 'label' | 'closeup'

export type ImageAnalysis = {
  warnings: string[]
  crop?: { x: number; y: number; width: number; height: number }
}

export function analyzeImagePixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  kind: ImageKind,
): ImageAnalysis {
  const luminance = new Float32Array(width * height)
  let sum = 0
  for (let index = 0; index < luminance.length; index++) {
    const offset = index * 4
    const value = pixels[offset]! * 0.2126 + pixels[offset + 1]! * 0.7152 + pixels[offset + 2]! * 0.0722
    luminance[index] = value
    sum += value
  }
  const mean = sum / Math.max(1, luminance.length)
  let gradientSum = 0
  const gradients: Array<{ value: number; x: number; y: number }> = []
  for (let y = 1; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const index = y * width + x
      const value = Math.abs(luminance[index]! - luminance[index - 1]!) + Math.abs(luminance[index]! - luminance[index - width]!)
      gradientSum += value
      gradients.push({ value, x, y })
    }
  }
  const gradientMean = gradientSum / Math.max(1, gradients.length)
  const warnings: string[] = []
  if (mean < 45) warnings.push('사진이 어두워 판독이 어려울 수 있습니다.')
  if (mean > 225) warnings.push('사진이 너무 밝아 라벨 글자가 흐려질 수 있습니다.')
  if (gradientMean < 7) warnings.push('사진이 흐리거나 초점이 약할 수 있습니다.')

  if (kind !== 'label' || width < 24 || height < 24) return { warnings }
  const threshold = Math.max(18, gradientMean * 1.7)
  const strong = gradients.filter(point => point.value >= threshold)
  if (strong.length < gradients.length * 0.015) return { warnings }
  const xs = strong.map(point => point.x).sort((a, b) => a - b)
  const ys = strong.map(point => point.y).sort((a, b) => a - b)
  const low = Math.floor(strong.length * 0.02)
  const high = Math.ceil(strong.length * 0.98) - 1
  let x1 = xs[low]!, x2 = xs[high]!, y1 = ys[low]!, y2 = ys[high]!
  const padX = Math.max(2, Math.round((x2 - x1) * 0.15))
  const padY = Math.max(2, Math.round((y2 - y1) * 0.2))
  x1 = Math.max(0, x1 - padX); x2 = Math.min(width - 1, x2 + padX)
  y1 = Math.max(0, y1 - padY); y2 = Math.min(height - 1, y2 + padY)
  const crop = { x: x1 / width, y: y1 / height, width: (x2 - x1 + 1) / width, height: (y2 - y1 + 1) / height }
  const area = crop.width * crop.height
  if (area >= 0.88 || crop.width < 0.3 || crop.height < 0.18) return { warnings }
  return { warnings, crop }
}

export function imageLongEdge(kind: ImageKind, fallback: number) {
  if (kind === 'label') return Math.max(fallback, 1800)
  if (kind === 'closeup') return Math.max(fallback, 1500)
  return fallback
}

export function imageQualities(kind: ImageKind) {
  return kind === 'label' ? [0.9, 0.8, 0.7, 0.6] : [0.85, 0.7, 0.5]
}
