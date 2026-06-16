import { tool, UIToolInvocation } from 'ai'

import { factCheckSchema } from '@/lib/schema/factcheck'

export interface FactCheckClaimReview {
  publisher: {
    name: string
    site?: string
  }
  url: string
  title?: string
  reviewDate?: string
  textualRating: string
  languageCode?: string
}

export interface FactCheckClaim {
  text: string
  claimant?: string
  claimDate?: string
  claimReview: FactCheckClaimReview[]
}

export interface FactCheckSearchResults {
  query: string
  claims: FactCheckClaim[]
}

export function createFactCheckTool() {
  return tool({
    description:
      'Search Google Fact Check Tools API to find fact-check reviews for specific claims, statements, or news stories. Returns a list of claims with their associated publisher reviews, URLs, and textual ratings (e.g., False, True, Misleading). Use when the user asks to verify, fact-check, or validate a rumor, claim, statement, or news story.',
    inputSchema: factCheckSchema,
    async *execute({ query, languageCode }, context) {
      yield {
        state: 'searching' as const,
        query
      }

      // API Key Fallback Strategy
      const apiKey =
        process.env.GOOGLE_FACT_CHECK_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

      if (!apiKey) {
        throw new Error(
          'Google Fact Check API Key is not configured. Please set GOOGLE_FACT_CHECK_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_MAPS_API_KEY in your environment.'
        )
      }

      const url = new URL(
        'https://factchecktools.googleapis.com/v1alpha1/claims:search'
      )
      url.searchParams.append('query', query)
      url.searchParams.append('key', apiKey)
      if (languageCode) {
        url.searchParams.append('languageCode', languageCode)
      }

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(
            `Google Fact Check API error: ${response.status} ${response.statusText}`
          )
        }

        const data = await response.json()
        const claims: FactCheckClaim[] = (data.claims || []).map((c: any) => ({
          text: c.text || '',
          claimant: c.claimant,
          claimDate: c.claimDate,
          claimReview: (c.claimReview || []).map((r: any) => ({
            publisher: {
              name: r.publisher?.name || '',
              site: r.publisher?.site
            },
            url: r.url || '',
            title: r.title,
            reviewDate: r.reviewDate,
            textualRating: r.textualRating || '',
            languageCode: r.languageCode
          }))
        }))

        const result: FactCheckSearchResults = {
          query,
          claims
        }

        yield {
          state: 'complete' as const,
          ...result,
          toolCallId: context?.toolCallId
        }
      } catch (error) {
        console.error('Fact-checking tool error:', error)
        throw error instanceof Error
          ? error
          : new Error('Unknown error during fact-checking')
      }
    }
  })
}

export const factCheckTool = createFactCheckTool()

export type FactCheckUIToolInvocation = UIToolInvocation<typeof factCheckTool>
