import { defineSchema } from '@json-render/core'
import { schema as reactSchema } from '@json-render/react/schema'

export const schema = defineSchema(
  s => ({
    spec: s.object({
      root: s.string(),
      elements: s.record(
        s.object({
          type: s.ref('catalog.components'),
          props: {
            ...s.propsOf('catalog.components'),
            ...s.optional()
          },
          children: {
            ...s.array(s.string()),
            ...s.optional()
          },
          on: {
            ...s.any(),
            ...s.optional()
          }
        })
      )
    }),
    catalog: s.object({
      components: s.map({
        props: s.zod(),
        slots: s.array(s.string()),
        description: s.string()
      }),
      actions: s.map({
        params: s.zod(),
        description: s.string()
      })
    })
  }),
  {
    builtInActions: reactSchema.builtInActions,
    defaultRules: reactSchema.defaultRules
  }
)
