export const CONTRACT_VERSION = '1.0.0' as const
export const LIMITS = {
  requestBytes: 4 * 1024 * 1024,
  evaluateBytes: 128 * 1024,
  imageBytes: 2 * 1024 * 1024,
  clientImageBytes: 1024 * 1024,
  imageLongEdge: 1280,
  maxItems: 30,
  requestTimeoutMs: 25_000,
  upstreamTimeoutMs: 20_000,
} as const
export const FIELD_KEYS = ['modelName', 'wh', 'mah', 'volts', 'ml', 'count'] as const
export const CATEGORY_IDS = ['power-bank', 'cordless-iron', 'liquid', 'lighter', 'electronics'] as const
export const DEMO_AIRLINE_ID = 'demo-airline'
