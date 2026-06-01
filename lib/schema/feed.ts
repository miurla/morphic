import { z } from 'zod'

export const feedSchema = z.object({
  action: z
    .enum(['discover', 'read'])
    .describe(
      'Use "discover" to find RSS, Atom, RDF/RSS, JSON Feed, or podcast feeds for a website. Use "read" to fetch and parse a known feed URL.'
    ),
  url: z
    .string()
    .describe(
      'The website or feed URL to inspect. Can be a homepage, domain, RSS/Atom/RDF feed, JSON Feed URL, or podcast feed URL.'
    ),
  max_items: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum number of feed entries or podcast episodes to return.'),
  include_podcast_metadata: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Include Podcasting 2.0 and iTunes podcast metadata when present.'
    )
})

export type FeedSchema = z.infer<typeof feedSchema>
