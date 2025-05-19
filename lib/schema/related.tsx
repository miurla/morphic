import { z } from 'zod'

export const relatedSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string()
    })
  )
})

export type Related = z.infer<typeof relatedSchema>
