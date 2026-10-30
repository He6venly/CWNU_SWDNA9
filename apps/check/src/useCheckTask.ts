import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../contract/client.ts'

export function useCheckTask() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [trace, setTrace] = useState<{ operation: string; request: unknown; response: unknown; elapsedMs: number } | null>(null)
  const active = useRef<AbortController | null>(null), generation = useRef(0)
  useEffect(() => () => { generation.current++; active.current?.abort() }, [])
  function cancel() { generation.current++; active.current?.abort(); setBusy(false); setTrace(null) }
  async function run<T>(operation: string, request: unknown, action: (signal: AbortSignal) => Promise<T>, apply: (response: T) => void) {
    cancel(); setMessage('')
    const id = generation.current, controller = new AbortController(); active.current = controller
    const start = performance.now(); setBusy(true)
    try {
      const response = await action(controller.signal)
      if (controller.signal.aborted || id !== generation.current) return
      apply(response); setTrace({ operation, request, response, elapsedMs: Math.round(performance.now() - start) })
    } catch (error) {
      if (controller.signal.aborted || id !== generation.current) return
      const text = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'
      setMessage(text); setTrace({ operation, request, response: error instanceof ApiError ? { error: { code: error.code, message: text }, status: error.status } : { error: text }, elapsedMs: Math.round(performance.now() - start) })
    } finally { if (id === generation.current) setBusy(false) }
  }
  return { busy, message, setMessage, trace, cancel, run }
}
