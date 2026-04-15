import type { Spec } from '@json-render/core'
import { describe, expect, test } from 'vitest'

import { migrateSpec, type MigrationMap } from '../migrations'

// Synthetic fixture so the tests exercise the migration infrastructure
// without committing to any real catalog entries.
const fixtureMigrations: MigrationMap = {
  LegacyHeading: { to: 'Heading' },
  LegacyButton: {
    to: 'Button',
    defaultProps: { variant: 'link', icon: 'arrow-right' }
  },
  // Chained rename: IntermediateHeading was itself renamed to LegacyHeading
  // at some point, and LegacyHeading is now Heading.
  IntermediateHeading: { to: 'LegacyHeading' }
}

function makeLegacySpec(): Spec {
  return {
    root: 'main',
    elements: {
      main: {
        type: 'Stack',
        props: { direction: 'vertical' },
        children: ['header', 'questions']
      },
      header: {
        type: 'LegacyHeading',
        props: { title: 'Related' },
        children: []
      },
      questions: {
        type: 'Stack',
        props: { direction: 'vertical' },
        children: ['q1']
      },
      q1: {
        type: 'LegacyButton',
        props: { text: 'First question' },
        on: {
          press: { action: 'submitQuery', params: { query: 'First question' } }
        },
        children: []
      }
    }
  } as unknown as Spec
}

describe('migrateSpec', () => {
  test('renames legacy type names to their current catalog names', () => {
    const spec = makeLegacySpec()
    const result = migrateSpec(spec, fixtureMigrations)

    const elements = result.elements as Record<string, { type: string }>
    expect(elements.header.type).toBe('Heading')
    expect(elements.q1.type).toBe('Button')
    // Untouched types stay the same.
    expect(elements.main.type).toBe('Stack')
    expect(elements.questions.type).toBe('Stack')
  })

  test('merges defaultProps without overriding existing props', () => {
    const spec = makeLegacySpec()
    const result = migrateSpec(spec, fixtureMigrations)
    const q1 = (
      result.elements as Record<string, { props: Record<string, unknown> }>
    ).q1

    // Existing prop preserved.
    expect(q1.props.text).toBe('First question')
    // Default props applied.
    expect(q1.props.variant).toBe('link')
    expect(q1.props.icon).toBe('arrow-right')
  })

  test('does not override an existing prop that happens to match a default', () => {
    const spec: Spec = {
      root: 'q1',
      elements: {
        q1: {
          type: 'LegacyButton',
          props: { text: 'X', variant: 'outline' },
          children: []
        }
      }
    } as unknown as Spec

    const result = migrateSpec(spec, fixtureMigrations)
    const q1 = (
      result.elements as Record<string, { props: Record<string, unknown> }>
    ).q1
    // LegacyButton's default variant is "link" but the original spec
    // already declared "outline" — that must win.
    expect(q1.props.variant).toBe('outline')
    // icon default still fills in because it was not provided.
    expect(q1.props.icon).toBe('arrow-right')
  })

  test('is idempotent — running the migration twice yields the same result', () => {
    const spec = makeLegacySpec()
    const once = migrateSpec(spec, fixtureMigrations)
    const twice = migrateSpec(once, fixtureMigrations)
    expect(twice).toEqual(once)
  })

  test('resolves chained renames through to the final target', () => {
    const spec: Spec = {
      root: 'header',
      elements: {
        header: {
          type: 'IntermediateHeading',
          props: { title: 'Chained' },
          children: []
        }
      }
    } as unknown as Spec

    const result = migrateSpec(spec, fixtureMigrations)
    const header = (result.elements as Record<string, { type: string }>).header
    expect(header.type).toBe('Heading')
  })

  test('returns the same object reference when no changes are needed', () => {
    const spec: Spec = {
      root: 'main',
      elements: {
        main: { type: 'Heading', props: { title: 'Up to date' }, children: [] }
      }
    } as unknown as Spec

    const result = migrateSpec(spec, fixtureMigrations)
    expect(result).toBe(spec)
  })

  test('leaves unknown types untouched so the renderer can report them', () => {
    const spec: Spec = {
      root: 'x',
      elements: {
        x: { type: 'TotallyUnknown', props: {}, children: [] }
      }
    } as unknown as Spec

    const result = migrateSpec(spec, fixtureMigrations)
    const x = (result.elements as Record<string, { type: string }>).x
    expect(x.type).toBe('TotallyUnknown')
  })
})
