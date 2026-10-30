import { useEffect, useRef, useState } from 'react'
import { prepareImage } from './image.ts'
import type { RecognizeRequest } from '../../../../contract/v2/types.ts'
import { LIMITS } from '../../../../contract/v2/constants.ts'

export type Photo = RecognizeRequest['images'][number] & { preview: string }
export default function PhotoPicker({
  maxImages,
  defaultKind,
  onStart,
  onChange,
  onWorking,
  onMessage,
}: {
  maxImages: number
  defaultKind: Photo['kind']
  onStart: () => void
  onChange: (photos: Photo[]) => void
  onWorking: (busy: boolean) => void
  onMessage: (message: string) => void
}) {
  const [working, setWorking] = useState(false)
  const active = useRef<AbortController | null>(null)
  const urls = useRef<string[]>([])
  useEffect(
    () => () => {
      active.current?.abort()
      urls.current.forEach(URL.revokeObjectURL)
    },
    [],
  )
  async function select(files: File[]) {
    active.current?.abort()
    onStart()
    urls.current.forEach(URL.revokeObjectURL)
    urls.current = []
    if (!files.length || files.length > maxImages) {
      onMessage(`사진은 1~${maxImages}장 선택해 주세요.`)
      return
    }
    const controller = new AbortController()
    active.current = controller
    setWorking(true)
    onWorking(true)
    const prepared: Photo[] = []
    const qualityWarnings: string[] = []
    let cropped = 0
    // base64의 4/3 팽창과 JSON 여유를 반영. 마지막 전체 크기는 클라이언트가 다시 검사.
    const imageBudget = Math.min(
      LIMITS.clientImageBytes,
      Math.floor(((LIMITS.requestBytes - 4096) * 3) / 4 / files.length),
    )
    try {
      // 고해상도 원본을 동시에 디코딩하지 않아 메모리 사용이 겹치지 않도록 순차 변환.
      for (const [index, file] of files.entries()) {
        const photo = await prepareImage(file, controller.signal, imageBudget, defaultKind)
        qualityWarnings.push(...photo.warnings)
        if (photo.cropApplied) cropped++
        prepared.push({
          id: `image-${index + 1}`,
          kind: defaultKind,
          ...photo.image,
          preview: photo.preview,
        })
      }
      controller.signal.throwIfAborted()
      urls.current = prepared.map((photo) => photo.preview)
      onChange(prepared)
      onMessage(
        `사진 ${prepared.length}장 준비 완료. 아직 분석 요청하지 않았습니다.${cropped ? ` 라벨 영역 자동 크롭 ${cropped}장 적용.` : ''}${qualityWarnings.length ? ` 경고: ${[...new Set(qualityWarnings)].join(' ')}` : ''}`,
      )
    } catch (error) {
      prepared.forEach((photo) => URL.revokeObjectURL(photo.preview))
      if (!controller.signal.aborted)
        onMessage(
          error instanceof Error ? error.message : '사진을 읽지 못했습니다.',
        )
    } finally {
      if (active.current === controller) {
        setWorking(false)
        onWorking(false)
      }
    }
  }
  return (
    <div className="file-picker">
      <label>
        기존 사진 선택 (최대 {maxImages}장)
        <input
          type="file"
          multiple={maxImages > 1}
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? [])
            event.currentTarget.value = ''
            void select(files)
          }}
        />
      </label>
      {working && (
        <p role="status">
          사진 변환 중…{' '}
          <button
            onClick={() => {
              active.current?.abort()
              onMessage('사진 변환을 취소했습니다.')
            }}
          >
            변환 취소
          </button>
        </p>
      )}
    </div>
  )
}
