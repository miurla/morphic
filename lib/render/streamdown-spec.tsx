'use client'

import type { CustomRenderer, PluginConfig } from 'streamdown'

import { DraftFenceCard } from '@/components/draft/draft-card'
import { SpecFenceBlock } from '@/components/spec-fence-block'

export function createStreamdownSpecRenderer(): CustomRenderer {
  return {
    language: 'spec',
    component({ code }) {
      return <SpecFenceBlock source={code} />
    }
  }
}

// A draft's content shows in the side panel; the answer keeps a card.
export function createStreamdownDraftRenderer(): CustomRenderer {
  return {
    language: 'draft',
    component({ code }) {
      return <DraftFenceCard code={code} />
    }
  }
}

export function mergeStreamdownSpecRenderer(
  plugins?: PluginConfig,
  { drafts = true }: { drafts?: boolean } = {}
): PluginConfig {
  const userRenderers = plugins?.renderers ?? []
  const filteredRenderers = userRenderers.filter(renderer => {
    const languages = Array.isArray(renderer.language)
      ? renderer.language
      : [renderer.language]
    return !languages.includes('spec') && !languages.includes('draft')
  })

  return {
    ...plugins,
    renderers: [
      createStreamdownSpecRenderer(),
      ...(drafts ? [createStreamdownDraftRenderer()] : []),
      ...filteredRenderers
    ]
  }
}
