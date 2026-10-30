import { createApiClient } from '../../../../contract/v2/client.ts'
// Vite's local /api proxy keeps server keys and provider settings on the backend.
export const api = createApiClient()
