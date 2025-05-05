import { DeepPartial } from 'ai'
import { z } from 'zod'

export const searchSchema = z.object({
  query: z.string().describe('The query to search for'),
  max_results: z
    .number()
    .optional()
    .describe('The maximum number of results to return. default is 20'),
  search_depth: z
    .string()
    .optional()
    .describe(
      'The depth of the search. Allowed values are "basic" or "advanced"'
    ),
  include_domains: z
    .array(z.string())
    .optional()
    .describe(
      'A list of domains to specifically include in the search results. Default is None, which includes all domains.'
    ),
  exclude_domains: z
    .array(z.string())
    .optional()
    .describe(
      "A list of domains to specifically exclude from the search results. Default is None, which doesn't exclude any domains."
    )
})

// Strict schema with all fields required
export const strictSearchSchema = z.object({
  query: z.string().describe('The query to search for'),
  max_results: z
    .number()
    .describe('The maximum number of results to return. default is 20'),
  search_depth: z
    .enum(['basic', 'advanced'])
    .describe('The depth of the search'),
  include_domains: z
    .array(z.string())
    .describe(
      'A list of domains to specifically include in the search results. Default is None, which includes all domains.'
    ),
  exclude_domains: z
    .array(z.string())
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
