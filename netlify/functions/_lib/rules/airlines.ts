import { supportedAirlines } from '../../../../contract/v2/airlines.ts'
import { airlineRuleMetadata, airlineRuleProfile, airlineRulesCurrent } from './airline-profiles.ts'

export { airlineRuleMetadata, airlineRuleProfile }

export function airlineEntry(id: string) {
  return supportedAirlines.find((airline) => airline.id === id)
}

export function supportedAirlineList(now = new Date()) {
  const current = airlineRulesCurrent(now)
  return supportedAirlines.map(airline => ({ ...airline, enabled: current && !!airlineRuleProfile(airline.id) }))
}
