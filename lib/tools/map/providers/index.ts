import { AppleMapsProvider } from './apple'
import { MapProvider } from './base'
import { GoogleMapsProvider } from './google'

export type MapProviderType = 'google' | 'apple'
export const DEFAULT_MAP_PROVIDER: MapProviderType = 'google'

export function createMapProvider(type?: MapProviderType): MapProvider {
  // At runtime, the agent can explicitly pass a provider type.
  // Falls back to MAPS_API env var, then defaults to 'google'.
  const providerType =
    type || (process.env.MAPS_API as MapProviderType) || DEFAULT_MAP_PROVIDER

  switch (providerType) {
    case 'apple':
      return new AppleMapsProvider()
    case 'google':
    default:
      return new GoogleMapsProvider()
  }
}

export { AppleMapsProvider } from './apple'
export { GoogleMapsProvider } from './google'
export type { MapProvider }
