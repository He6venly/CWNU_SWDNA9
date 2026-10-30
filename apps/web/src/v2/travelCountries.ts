export const travelCountries = [
  { code: 'KR', name: '대한민국' },
  { code: 'JP', name: '일본' },
  { code: 'VN', name: '베트남' },
  { code: 'TH', name: '태국' },
  { code: 'PH', name: '필리핀' },
  { code: 'TW', name: '대만' },
  { code: 'CN', name: '중국' },
  { code: 'HK', name: '홍콩' },
  { code: 'US', name: '미국' },
  { code: 'SG', name: '싱가포르' },
  { code: 'MY', name: '말레이시아' },
  { code: 'ID', name: '인도네시아' },
  { code: 'GU', name: '괌' },
  { code: 'AU', name: '호주' },
  { code: 'CA', name: '캐나다' },
  { code: 'FR', name: '프랑스' },
  { code: 'ES', name: '스페인' },
  { code: 'IT', name: '이탈리아' },
  { code: 'GB', name: '영국' },
  { code: 'DE', name: '독일' },
  { code: 'NZ', name: '뉴질랜드' },
] as const

export function countryName(value: string) {
  return travelCountries.find((country) => country.code === value)?.name ?? value
}

export function normalizeCountry(value: string | undefined, fallback = 'KR') {
  if (!value) return fallback
  if (value === '대한민국') return 'KR'
  return travelCountries.find((country) => country.name === value)?.code ?? value
}

export function isTravelCountry(value: string) {
  return travelCountries.some((country) => country.code === value)
}
import type { FlightType } from '../../../../contract/v2/types.ts'


export function flightTypeForCountries(origin: string, destination: string, current: FlightType): FlightType {
  if (origin && origin !== 'KR') return 'international'
  if (!destination) return current
  return destination === 'KR' ? 'domestic' : 'international'
}
