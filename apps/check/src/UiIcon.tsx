import flightIcon from '../../../changgo-icons/icon-flight.svg'
import photoIcon from '../../../changgo-icons/icon-photo-scan.svg'
import quickIcon from '../../../changgo-icons/icon-quick-check.svg'
import verifyIcon from '../../../changgo-icons/icon-verify.svg'
import albumIcon from '../../../changgo-icons/icon-trip-album.svg'
import catalogIcon from '../../../changgo-icons/icon-catalog.svg'
import powerIcon from '../../../changgo-icons/quick-power-bank.svg'
import ironIcon from '../../../changgo-icons/quick-hair-iron.svg'
import liquidIcon from '../../../changgo-icons/quick-liquid.svg'
import electronicsIcon from '../../../changgo-icons/quick-electronics.svg'
import lighterIcon from '../../../changgo-icons/quick-lighter.svg'
import generalIcon from '../../../changgo-icons/quick-general.svg'
import searchIcon from '../../../changgo-icons/icon-search.svg'

export type UiIconName = 'flight' | 'photo' | 'quick' | 'verify' | 'album' | 'catalog' | 'power' | 'iron' | 'liquid' | 'electronics' | 'lighter' | 'general' | 'search'

const icons: Record<UiIconName, string> = {
  flight: flightIcon,
  photo: photoIcon,
  quick: quickIcon,
  verify: verifyIcon,
  album: albumIcon,
  catalog: catalogIcon,
  power: powerIcon,
  iron: ironIcon,
  liquid: liquidIcon,
  electronics: electronicsIcon,
  lighter: lighterIcon,
  general: generalIcon,
  search: searchIcon,
}

export default function UiIcon({ name, compact = false }: { name: UiIconName; compact?: boolean }) {
  return <span className={`ui-icon ui-icon-${name}${compact ? ' ui-icon-compact' : ''}`} aria-hidden="true">
    <img src={icons[name]} alt="" />
  </span>
}
