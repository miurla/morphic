'use client'

import { defineRegistry } from '@json-render/react'

import { Badge } from './components/badge'
import { Button } from './components/button'
import { Card } from './components/card'
import { Grid } from './components/grid'
import { Heading } from './components/heading'
import { Image } from './components/image'
import { Stack } from './components/stack'
import { Text } from './components/text'
import { catalog } from './catalog'

export const { registry } = defineRegistry(catalog, {
  components: {
    Heading,
    Stack,
    Button,
    Grid,
    Image,
    Card,
    Text,
    Badge
  },
  actions: {
    submitQuery: async () => {
      // Handled by ActionProvider at runtime
    }
  }
})
