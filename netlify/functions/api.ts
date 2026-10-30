import type { Config } from '@netlify/functions'
import { handleApi } from './_lib/api.ts'

export default function handler(request: Request) { return handleApi(request) }
export const config: Config = { path: '/api/*' }
