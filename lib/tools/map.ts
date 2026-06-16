import { tool, UIToolInvocation } from 'ai'

import { mapSchema } from '@/lib/schema/map'
import { MapSearchResults } from '@/lib/types/map'

import { createMapProvider, MapProviderType } from './map/providers'

export function createMapTool() {
  return tool({
    description:
      'Perform map actions: find nearby places/businesses ("search_places") or calculate driving directions between two locations ("get_directions"). Defaults to Google Maps but can use Apple Maps if requested.',
    inputSchema: mapSchema,
    async *execute(
      { action, provider, query, location, origin, destination },
      context
    ) {
      yield {
        state: 'searching' as const,
        action,
        provider: provider || 'google',
        query,
        origin,
        destination
      }

      let result: MapSearchResults

      try {
        const mapProvider = createMapProvider(provider as MapProviderType)
        const resolvedProvider = (provider ||
          process.env.MAPS_API ||
          'google') as 'google' | 'apple'

        if (action === 'get_directions') {
          if (!origin || !destination) {
            throw new Error(
              'Both "origin" and "destination" are required for get_directions.'
            )
          }
          const directions = await mapProvider.getDirections(
            origin,
            destination
          )
          result = {
            action: 'get_directions',
            provider: resolvedProvider,
            origin,
            destination,
            directions
          }
        } else {
          // Default: search_places
          if (!query) {
            throw new Error('"query" is required for search_places.')
          }
          const places = await mapProvider.searchPlaces(query, location)
          result = {
            action: 'search_places',
            provider: resolvedProvider,
            query,
            places
          }
        }
      } catch (error) {
        console.error('Map tool error:', error)
        throw error instanceof Error ? error : new Error('Unknown map error')
      }

      yield {
        state: 'complete' as const,
        ...result,
        toolCallId: context?.toolCallId
      }
    }
  })
}

export const mapTool = createMapTool()

export type MapUIToolInvocation = UIToolInvocation<typeof mapTool>
