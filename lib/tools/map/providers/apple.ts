import { importPKCS8, SignJWT } from 'jose'

import { MapDirections, MapPlace } from '@/lib/types/map'

import { BaseMapProvider } from './base'

export class AppleMapsProvider extends BaseMapProvider {
  private async generateToken(): Promise<string> {
    const teamId = process.env.APPLE_MAPS_TEAM_ID
    const keyId = process.env.APPLE_MAPS_KEY_ID
    const privateKeyStr = process.env.APPLE_MAPS_PRIVATE_KEY

    if (!teamId || !keyId || !privateKeyStr) {
      throw new Error(
        'Apple Maps credentials (TEAM_ID, KEY_ID, PRIVATE_KEY) are missing in environment variables.'
      )
    }

    const privateKey = await importPKCS8(
      privateKeyStr.replace(/\\n/g, '\n'),
      'ES256'
    )

    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
      .setIssuer(teamId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey)
  }

  async searchPlaces(
    query: string,
    location?: { lat: number; lng: number }
  ): Promise<MapPlace[]> {
    const token = await this.generateToken()

    const url = new URL('https://maps-api.apple.com/v1/search')
    url.searchParams.append('q', query)
    if (location) {
      url.searchParams.append(
        'searchLocation',
        `${location.lat},${location.lng}`
      )
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
      throw new Error(
        `Apple Maps Search error: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    return (data.results || []).map((result: Record<string, unknown>) => {
      const lines = result.formattedAddressLines as string[] | undefined
      return {
        id: (result.name as string) || query,
        name: (result.name as string) || query,
        address: lines ? lines.join(', ') : '',
        location: result.coordinate
          ? {
              lat: (result.coordinate as Record<string, number>).latitude,
              lng: (result.coordinate as Record<string, number>).longitude
            }
          : undefined,
        phoneNumber: (result.phone as string) || undefined,
        url: (result.url as string) || undefined
      }
    })
  }

  async getDirections(
    origin: string,
    destination: string
  ): Promise<MapDirections> {
    const token = await this.generateToken()

    const url = new URL('https://maps-api.apple.com/v1/directions')
    url.searchParams.append('origin', origin)
    url.searchParams.append('destination', destination)
    url.searchParams.append('transportType', 'automobile')

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
      throw new Error(
        `Apple Maps Directions error: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()
    const route = data.routes?.[0]

    if (!route) {
      throw new Error('No route found between origin and destination.')
    }

    const steps: string[] = (route.steps || [])
      .map((step: Record<string, unknown>) => step.instructions as string)
      .filter(Boolean)

    const distanceKm = ((route.distanceMeters as number) / 1000).toFixed(1)
    const durationMin = Math.round((route.durationSeconds as number) / 60)

    return {
      distanceText: `${distanceKm} km`,
      durationText: `${durationMin} min`,
      startAddress: origin,
      endAddress: destination,
      steps
    }
  }
}
