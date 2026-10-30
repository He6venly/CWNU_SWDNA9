import { LIMITS as legacyLimits } from '../constants.ts'

export const CONTRACT_VERSION = '2.0.0' as const
export const API_PREFIX = '/api/v2'
export const FIELD_KEYS = ['brand', 'modelName', 'wh', 'mah', 'volts', 'ml', 'count'] as const
export const CATEGORY_IDS = ['power-bank', 'cordless-iron', 'liquid', 'lighter', 'electronics', 'general-items'] as const
export const FLIGHT_TYPES = ['domestic', 'international'] as const
export const DEPARTURE_COUNTRY = 'KR' as const
export const LIMITS = { ...legacyLimits, maxImages: 3, overviewImages: 1 } as const
