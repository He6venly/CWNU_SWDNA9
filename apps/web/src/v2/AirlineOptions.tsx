import type { Airline, FlightType } from '../../../../contract/v2/types.ts'
import { domesticAirlineIds } from '../../../../contract/v2/airlines.ts'

export default function AirlineOptions({ airlines, flightType }: { airlines: Airline[]; flightType: FlightType }) {
  const actual = airlines.filter((airline) => !airline.isDemo)
  const options = (entries: Airline[]) => entries.map((airline) => {
    const routeUnavailable = !airline.supportedFlightTypes.includes(flightType)
    return <option key={airline.id} value={airline.id} disabled={!airline.enabled || routeUnavailable}>{airline.name}{routeUnavailable ? ' · 국제선 전용' : !airline.enabled ? ' · 준비 중' : ''}</option>
  })
  return <>
    <optgroup label="국내 여객 항공사">{options(actual.filter((airline) => domesticAirlineIds.has(airline.id)))}</optgroup>
    <optgroup label="한국 출발 해외 주요 5개 항공사">{options(actual.filter((airline) => !domesticAirlineIds.has(airline.id)))}</optgroup>
  </>
}
