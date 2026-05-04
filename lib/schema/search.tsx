import { DeepPartial } from 'ai'
import { z } from 'zod'

import { getSearchTypeDescription } from '@/lib/utils/search-config'

export const searchSchema = z.object({
  query: z.string().describe('The query to search for'),
  type: z
    .enum(['general', 'optimized'])
    .optional()
    .default('optimized')
    .describe(getSearchTypeDescription()),
  content_types: z
    .array(z.enum(['web', 'video', 'image', 'news']))
    .optional()
    .default(['web'])
    .describe(
      'Preserved for compatibility. AgriEvidence search currently returns web evidence snippets from Parallel and ignores multimedia content types.'
    ),
  max_results: z
    .number()
    .optional()
    .default(20)
    .describe('The maximum number of results to return. default is 20'),
  search_depth: z
    .string()
    .optional()
    .default('basic')
    .describe(
      'The depth of the search. Allowed values are "basic" or "advanced"'
    ),
  include_domains: z
    .array(z.string())
    .nullish()
    .transform(val => val ?? [])
    .describe(
      'Optional additional domains. AgriEvidence primarily uses trusted agricultural domains from the Supabase sources table.'
    ),
  exclude_domains: z
    .array(z.string())
    .nullish()
    .transform(val => val ?? [])
    .describe(
      "A list of domains to specifically exclude from the search results. Default is None, which doesn't exclude any domains."
    )
})

// Strict schema with all fields required
export const strictSearchSchema = z.object({
  query: z.string().describe('The query to search for'),
  type: z.enum(['general', 'optimized']).describe(getSearchTypeDescription()),
  content_types: z
    .array(z.enum(['web', 'video', 'image', 'news']))
    .describe(
      'Preserved for compatibility. AgriEvidence search currently returns web evidence snippets from Parallel and ignores multimedia content types.'
    ),
  max_results: z.number().describe('The maximum number of results to return.'),
  search_depth: z
    .enum(['basic', 'advanced'])
    .describe('The depth of the search'),
  include_domains: z
    .array(z.string())
    .nullish()
    .transform(val => val ?? [])
    .describe(
      'Optional additional domains. AgriEvidence primarily uses trusted agricultural domains from the Supabase sources table.'
    ),
  exclude_domains: z
    .array(z.string())
    .nullish()
    .transform(val => val ?? [])
    .describe(
      "A list of domains to specifically exclude from the search results. Default is None, which doesn't exclude any domains."
    )
})

/**
 * Returns the appropriate search schema based on the full model name.
 * Uses the strict schema for OpenAI models starting with 'o'.
 */
export function getSearchSchemaForModel(fullModel: string) {
  const [provider, modelName] = fullModel?.split(':') ?? []
  const useStrictSchema =
    (provider === 'openai' || provider === 'azure') &&
    modelName?.startsWith('o')

  // Ensure search_depth is an enum for the strict schema
  if (useStrictSchema) {
    return strictSearchSchema
  } else {
    // For the standard schema, keep search_depth as optional string
    return searchSchema
  }
}

export type PartialInquiry = DeepPartial<typeof searchSchema>
