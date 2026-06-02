import { describe, expect, it } from 'vitest'

import { searchSchema } from '@/lib/schema/search'

describe('searchSchema', () => {
  it('coerces OpenAI-compatible stringified tool inputs', () => {
    const parsed = searchSchema.parse({
      query: 'Cape Verde islands',
      type: 'optimized',
      content_types: "['web']",
      max_results: '20',
      search_depth: 'basic',
      include_domains: 'None',
      exclude_domains: 'null'
    })

    expect(parsed).toEqual({
      query: 'Cape Verde islands',
      type: 'optimized',
      content_types: ['web'],
      max_results: 20,
      search_depth: 'basic',
      include_domains: [],
      exclude_domains: []
    })
  })
})
