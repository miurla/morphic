'use client'

import type { CustomRenderer, PluginConfig } from 'streamdown'

import { SpecFenceBlock } from '@/components/spec-fence-block'

export function createStreamdownSpecRenderer(): CustomRenderer {
  return {
    language: 'spec',
    component({ code, isIncomplete }) {
      return (
        <SpecFenceBlock
          source={code}
          complete={!isIncomplete}
          showErrors={!isIncomplete}
        />
      )
    }
  }
}

export function mergeStreamdownSpecRenderer(
  plugins?: PluginConfig
): PluginConfig {
  const userRenderers = plugins?.renderers ?? []
  const filteredRenderers = userRenderers.filter(renderer => {
    const languages = Array.isArray(renderer.language)
      ? renderer.language
      : [renderer.language]
    return !languages.includes('spec')
  })

  return {
    ...plugins,
    renderers: [createStreamdownSpecRenderer(), ...filteredRenderers]
  }
}
