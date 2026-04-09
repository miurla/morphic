import { z } from 'zod'

import { schema } from './schema'

export const catalog = schema.createCatalog({
  components: {
    SectionHeader: {
      props: z.object({
        title: z.string(),
        icon: z.enum(['related']).optional()
      }),
      description: 'A section heading label with optional icon'
    },
    Stack: {
      props: z
        .object({
          direction: z.enum(['vertical', 'horizontal']).optional(),
          gap: z.enum(['xs', 'sm', 'md', 'lg']).optional()
        })
        .partial(),
      description:
        'A layout container that stacks children vertically or horizontally'
    },
    QuestionButton: {
      props: z.object({
        text: z.string()
      }),
      description: 'A related follow-up question the user can click to ask'
    }
  },
  actions: {
    submitQuery: {
      params: z.object({
        query: z.string()
      }),
      description: 'Submit a follow-up query to the chat'
    }
  }
})
