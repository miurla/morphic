import { MapDirections, MapPlace } from '@/lib/types/map'

import { BaseMapProvider } from './base'

export class GoogleMapsProvider extends BaseMapProvider {
  async searchPlaces(
    query: string,
    location?: { lat: number; lng: number }
  ): Promise<MapPlace[]> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    this.validateApiKey(apiKey, 'GOOGLE_MAPS')

    const url = 'https://places.googleapis.com/v1/places:searchText'

    const body: Record<string, unknown> = { textQuery: query }
    if (location) {
      body.locationBias = {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius: 50000.0
        }
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.websiteUri,places.nationalPhoneNumber'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(
        `Google Maps Places error: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    return (data.places || []).map((place: Record<string, unknown>) => ({
      id: place.id as string,
      name: (place.displayName as Record<string, string>)?.text || '',
      address: (place.formattedAddress as string) || '',
      location: place.location
        ? {
            lat: (place.location as Record<string, number>).latitude,
            lng: (place.location as Record<string, number>).longitude
          }
        : undefined,
      rating: place.rating as number | undefined,
      url: place.websiteUri as string | undefined,
      phoneNumber: place.nationalPhoneNumber as string | undefined
    }))
  }

  async getDirections(origin: string, destination: string): Promise<MapDirections> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    this.validateApiKey(apiKey, 'GOOGLE_MAPS')

    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes'

    const body = {
      origin: { address: origin },
      destination: { address: destination },
      travelMode: 'DRIVE',
      computeAlternativeRoutes: false
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration,routes.legs.startLocation,routes.legs.endLocation,routes.legs.steps.navigationInstruction,routes.legs.localizedValues'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(
        `Google Maps Routes error: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()
    const route = data.routes?.[0]
    const leg = route?.legs?.[0]

    if (!leg) {
      throw new Error('No route found between origin and destination.')
    }

    const steps: string[] = (leg.steps || [])
      .map(
        (step: Record<string, unknown>) =>
          (step.navigationInstruction as Record<string, string>)?.instructions || ''
      )
      .filter(Boolean)

    return {
      distanceText: leg.localizedValues?.distance?.text || `${leg.distanceMeters}m`,
      durationText: leg.localizedValues?.duration?.text || leg.duration,
      startAddress: origin,
      endAddress: destination,
      steps
    }
  }
}
