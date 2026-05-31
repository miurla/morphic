import { MapDirections, MapPlace } from '@/lib/types/map'

export interface MapProvider {
  searchPlaces(query: string, location?: { lat: number; lng: number }): Promise<MapPlace[]>
  getDirections(origin: string, destination: string): Promise<MapDirections>
}

export abstract class BaseMapProvider implements MapProvider {
  abstract searchPlaces(query: string, location?: { lat: number; lng: number }): Promise<MapPlace[]>
  abstract getDirections(origin: string, destination: string): Promise<MapDirections>

  protected validateApiKey(key: string | undefined, providerName: string): asserts key is string {
    if (!key) {
      throw new Error(`${providerName}_API_KEY is not set in the environment variables`)
    }
  }
}
