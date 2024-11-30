import { DeepPartial } from 'ai'
import { z } from 'zod'

export const retrieveSchema = z.object({
  url: z.string().describe('The url to retrieve')
})

export type PartialInquiry = DeepPartial<typeof retrieveSchema>
