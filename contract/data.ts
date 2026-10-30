import { CONTRACT_VERSION, DEMO_AIRLINE_ID, LIMITS } from './constants.ts'
import { labels } from './labels.ts'
import { CategoriesResponseSchema, MetaResponseSchema } from './schemas.ts'

export const demoMeta = { isDemoRecognition: true, isDemoRules: true, contractVersion: CONTRACT_VERSION } as const
export const demoAirlines = [
  { id: DEMO_AIRLINE_ID, name: '시연 항공사 (실제 항공사 아님)', enabled: true, isDemo: true },
  { id: 'pending-airline-1', name: '항공사 연동 준비 중', enabled: false, isDemo: true },
]
export const demoCategories = CategoriesResponseSchema.parse({
  airlineId: DEMO_AIRLINE_ID, meta: demoMeta,
  categories: [
    { id: 'power-bank', label: '보조배터리', requiredFields: { cabin: ['wh'], checked: [] } },
    { id: 'cordless-iron', label: '무선 고데기', requiredFields: { cabin: ['modelName'], checked: ['modelName'] } },
    { id: 'liquid', label: '액체·젤류', requiredFields: { cabin: ['ml'], checked: [] } },
    { id: 'lighter', label: '라이터', requiredFields: { cabin: ['count'], checked: [] } },
    { id: 'electronics', label: '일반 전자기기', requiredFields: { cabin: [], checked: [] } },
  ],
})
export const demoMetadata = MetaResponseSchema.parse({
  meta: demoMeta, labels, limits: LIMITS,
  capabilities: { recognition: 'demo', productLookup: 'demo', evaluation: 'stub' },
})
