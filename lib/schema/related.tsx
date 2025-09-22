import { z } from 'zod'

export const relatedQuestionSchema = z.object({
  question: z.string()
})

export const relatedSchema = z.array(relatedQuestionSchema).length(3)

export type RelatedQuestion = z.infer<typeof relatedQuestionSchema>
export type Related = z.infer<typeof relatedSchema>
