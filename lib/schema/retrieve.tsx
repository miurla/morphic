import { DeepPartial } from 'ai'
import { z } from 'zod'

export const retrieveSchema = z.object({
  url: z.string().url().describe('The url to retrieve')
})

export type PartialInquiry = DeepPartial<typeof retrieveSchema>
