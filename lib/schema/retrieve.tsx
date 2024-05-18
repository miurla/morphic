import { DeepPartial } from 'ai'
import { z } from 'zod'

export const retrieveSchema = z.object({
  urls: z.array(z.string().url()).describe('The urls to retrieve')
})

export type PartialInquiry = DeepPartial<typeof retrieveSchema>
