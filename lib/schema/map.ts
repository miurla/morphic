import { z } from 'zod'

export const mapSchema = z.object({
  action: z
    .enum(['search_places', 'get_directions'])
    .describe(
      'The map action to perform: "search_places" to find locations or businesses, "get_directions" to calculate a route between two points.'
    ),
  provider: z
    .enum(['google', 'apple'])
    .optional()
    .describe(
      'The map provider to use. Defaults to google unless explicitly required.'
    ),
  query: z
    .string()
    .optional()
    .describe(
      'For search_places: The name of the place, business, or address to search for.'
    ),
  location: z
    .object({
      lat: z.number(),
      lng: z.number()
    })
    .optional()
    .describe(
      'For search_places: Optional geographic coordinates to bias the search results around a specific location.'
    ),
  origin: z
    .string()
    .optional()
    .describe(
      'For get_directions: The starting address, place name, or coordinates.'
    ),
  destination: z
    .string()
    .optional()
    .describe(
      'For get_directions: The ending address, place name, or coordinates.'
    )
})

export type MapSchema = z.infer<typeof mapSchema>
