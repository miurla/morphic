import { DeepPartial } from 'ai'
import { z } from 'zod'

export const inquirySchema = z.object({
  inquiry: z.string().describe(''),
  options: z.array(
    z.object({
      name: z.string(),
      label: z.string()
    })
  ),
  names: z.array(z.string()),
  allowsInput: z.boolean(),
  inputLabel: z.string().optional(),
  inputPlaceholder: z.string().optional()
})

export type PartialInquiry = DeepPartial<typeof inquirySchema>
