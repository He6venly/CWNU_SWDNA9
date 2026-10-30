export const supportedAirlines = [
  { id: 'korean-air', name: '대한항공', enabled: true, isDemo: false, supportedFlightTypes: ['domestic', 'international'] },
  { id: 'asiana-airlines', name: '아시아나항공', enabled: true, isDemo: false, supportedFlightTypes: ['domestic', 'international'] },
  { id: 'jeju-air', name: '제주항공', enabled: true, isDemo: false, supportedFlightTypes: ['domestic', 'international'] },
  { id: 'jin-air', name: '진에어', enabled: true, isDemo: false, supportedFlightTypes: ['domestic', 'international'] },
  { id: 'air-busan', name: '에어부산', enabled: true, isDemo: false, supportedFlightTypes: ['domestic', 'international'] },
  { id: 'eastar-jet', name: '이스타항공', enabled: true, isDemo: false, supportedFlightTypes: ['domestic', 'international'] },
  { id: 'tway-air', name: '티웨이항공', enabled: true, isDemo: false, supportedFlightTypes: ['domestic', 'international'] },
  { id: 'air-seoul', name: '에어서울', enabled: true, isDemo: false, supportedFlightTypes: ['domestic', 'international'] },
  { id: 'air-premia', name: '에어프레미아', enabled: true, isDemo: false, supportedFlightTypes: ['international'] },
  { id: 'aero-k', name: '에어로케이', enabled: true, isDemo: false, supportedFlightTypes: ['domestic', 'international'] },
  { id: 'parata-air', name: '파라타항공', enabled: true, isDemo: false, supportedFlightTypes: ['domestic', 'international'] },
  { id: 'china-southern', name: '중국남방항공', enabled: true, isDemo: false, supportedFlightTypes: ['international'] },
  { id: 'china-eastern', name: '중국동방항공', enabled: true, isDemo: false, supportedFlightTypes: ['international'] },
  { id: 'air-china', name: '중국국제항공', enabled: true, isDemo: false, supportedFlightTypes: ['international'] },
  { id: 'vietnam-airlines', name: '베트남항공', enabled: true, isDemo: false, supportedFlightTypes: ['international'] },
  { id: 'delta-air-lines', name: '델타항공', enabled: true, isDemo: false, supportedFlightTypes: ['international'] },
] as const

export const domesticAirlineIds: ReadonlySet<string> = new Set(supportedAirlines.filter((airline) => airline.supportedFlightTypes.some(type => type === 'domestic')).map((airline) => airline.id))
