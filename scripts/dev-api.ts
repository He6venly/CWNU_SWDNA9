import { Readable } from 'node:stream'
import type { Plugin } from 'vite'
import { handleApi } from '../netlify/functions/_lib/api.ts'
import type { ApiEnvironment } from '../netlify/functions/_lib/api.ts'

// CLI/서버 프레임워크 추가 없이 배포와 같은 Request→Response 핸들러 실행.
export function devApi(environment: ApiEnvironment): Plugin {
  return {
    name: 'local-functions-api',
    configureServer(server) {
      server.middlewares.use(async (incoming, outgoing, next) => {
        if (!incoming.url?.startsWith('/api')) return next()
        const controller = new AbortController()
        const abort = () => controller.abort()
        incoming.once('aborted', abort)
        try {
          const headers = new Headers()
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
          }
          const method = incoming.method ?? 'GET'
          const init: RequestInit & { duplex: 'half' } = { method, headers, signal: controller.signal, duplex: 'half' }
          if (method !== 'GET' && method !== 'HEAD') init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>
          const request = new Request(new URL(incoming.url, `http://${incoming.headers.host ?? 'localhost:5173'}`), init)
          const response = await handleApi(request, environment)
          outgoing.writeHead(response.status, Object.fromEntries(response.headers))
          outgoing.end(Buffer.from(await response.arrayBuffer()))
        } catch {
          outgoing.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
          outgoing.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: '요청을 처리하지 못했습니다.' } }))
        } finally { incoming.removeListener('aborted', abort) }
      })
    },
  }
}
