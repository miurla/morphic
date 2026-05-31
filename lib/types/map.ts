export interface MapLocation {
  lat: number
  lng: number
}

export interface MapPlace {
  id: string
  name: string
  address: string
  location?: MapLocation
  rating?: number
  url?: string
  phoneNumber?: string
}

export interface MapDirections {
  distanceText: string
  durationText: string
  startAddress: string
  endAddress: string
  steps: string[]
}

export interface MapSearchResults {
  action: 'search_places' | 'get_directions'
  provider: 'google' | 'apple'
  query?: string
  places?: MapPlace[]
  origin?: string
  destination?: string
  directions?: MapDirections
}
