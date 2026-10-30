import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../../contract/v2/client.ts'

export function useCheckTask() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const active = useRef<AbortController | null>(null),
    generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
      active.current?.abort()
    },
    [],
  )
  function cancel() {
    generation.current++
    active.current?.abort()
    setBusy(false)
  }
  async function run<T>(
    _operation: string,
    _request: unknown,
    action: (signal: AbortSignal) => Promise<T>,
    apply: (response: T) => void,
  ) {
    cancel()
    setMessage('')
    const id = generation.current,
      controller = new AbortController()
    active.current = controller
    setBusy(true)
    try {
      const response = await action(controller.signal)
      if (!controller.signal.aborted && id === generation.current)
        apply(response)
    } catch (error) {
      if (controller.signal.aborted || id !== generation.current) return
      const text =
        error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'
      setMessage(
        `${text} ${error instanceof ApiError && error.status === 409 ? '규정 재검수가 필요합니다. 최신 규정 상태를 새로 확인해 주세요.' : '입력은 보존됩니다. 사진 교체·직접 입력 또는 버튼으로 재시도할 수 있습니다.'}`,
      )
    } finally {
      if (id === generation.current) setBusy(false)
    }
  }
  return { busy, message, setMessage, cancel, run }
}
