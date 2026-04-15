import { z } from 'zod'

import { schema } from './schema'

const iconName = z.enum(['related', 'arrow-right']).optional()

export const catalog = schema.createCatalog({
  components: {
    Heading: {
      props: z.object({
        title: z.string(),
        icon: iconName
      }),
      description: 'A heading label with an optional icon'
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
    Button: {
      props: z.object({
        text: z.string(),
        icon: iconName,
        variant: z
          .enum(['default', 'outline', 'ghost', 'link', 'secondary'])
          .optional()
      }),
      description:
        'A clickable button that emits a press action. Use variant="link" with icon="arrow-right" for inline follow-up suggestions.'
    },
    Grid: {
      props: z.object({
        columns: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4)
        ]),
        gap: z.enum(['xs', 'sm', 'md', 'lg']).optional()
      }),
      description:
        'A fixed-column CSS grid container. Used to lay out images so that cell widths are determined upfront.'
    },
    Image: {
      props: z.object({
        src: z.string(),
        sourceUrl: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        aspectRatio: z.enum(['1:1', '16:9', '4:3']).optional()
      }),
      description:
        'An inline image referencing a web source; click to expand with credit'
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
