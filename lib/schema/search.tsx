import { DeepPartial } from 'ai'
import { z } from 'zod'

/*export const searchSchema = z.object({
  query: z.string().describe('The query to search for'),
  max_results: z
    .number()
    .max(20)
    .default(5)
    .describe('The maximum number of results to return'),
  search_depth: z
    .enum(['basic', 'advanced'])
    .default('basic')
    .describe('The depth of the search')
})*/
export const searchSchema = z.object({
  title_query: z
    .string()
    .describe(
      'keywords matching in Product title separated by comma e.g. Panasonic, Sony, 720p, Plasma, QLED'
    ),
  tags_query: z
    .string()
    .describe(
      'matching tags separated by comma e.g. Wireless, Bluetooth, HDMI, Smart TV'
    ),
  vendor_query: z
    .string()
    .describe(
      'Vendors separated by comma, who are selling given product e.g. Bot Doodle'
    )
  /*filters: z.array(
    z.object({
      price: z
        .object({ min: z.number, max: z.number })
        .describe('Matching price range')
    })
  )*/
})

export type PartialInquiry = DeepPartial<typeof searchSchema>
