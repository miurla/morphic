'use client'

import { defineRegistry } from '@json-render/react'

import { Grid } from './components/grid'
import { Image } from './components/image'
import { QuestionButton } from './components/question-button'
import { SectionHeader } from './components/section-header'
import { Stack } from './components/stack'
import { catalog } from './catalog'

export const { registry } = defineRegistry(catalog, {
  components: {
    SectionHeader,
    Stack,
    QuestionButton,
    Grid,
    Image
  },
  actions: {
    submitQuery: async () => {
      // Handled by ActionProvider at runtime
    }
  }
})
