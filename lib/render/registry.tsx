'use client'

import { defineRegistry } from '@json-render/react'

import { Button } from './components/button'
import { Grid } from './components/grid'
import { Heading } from './components/heading'
import { Image } from './components/image'
import { Stack } from './components/stack'
import { catalog } from './catalog'

export const { registry } = defineRegistry(catalog, {
  components: {
    Heading,
    Stack,
    Button,
    Grid,
    Image
  },
  actions: {
    submitQuery: async () => {
      // Handled by ActionProvider at runtime
    }
  }
})
