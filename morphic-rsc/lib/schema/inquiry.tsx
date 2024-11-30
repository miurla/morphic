import { DeepPartial } from 'ai'
import { z } from 'zod'

export const inquirySchema = z.object({
  question: z.string().describe('The inquiry question'),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string()
      })
    )
    .describe('The inquiry options'),
  allowsInput: z.boolean().describe('Whether the inquiry allows for input'),
  inputLabel: z.string().optional().describe('The label for the input field'),
  inputPlaceholder: z
    .string()
    .optional()
    .describe('The placeholder for the input field')
})

export type PartialInquiry = DeepPartial<typeof inquirySchema>
