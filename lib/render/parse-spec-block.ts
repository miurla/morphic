import {
  compileSpecStream,
  createSpecStreamCompiler,
  formatSpecIssues,
  type Spec,
  validateSpec
} from '@json-render/core'

import { catalog } from './catalog'
import { migrateSpec } from './migrations'

function compileSource(source: string): Spec {
  return compileSpecStream(source, {
    root: '',
    elements: {}
  }) as Spec
}

function prunePartialSpec(spec: Spec): Spec {
  const elementKeys = new Set(Object.keys(spec.elements ?? {}))
  const elements = Object.fromEntries(
    Object.entries(spec.elements ?? {}).map(([key, element]) => [
      key,
      {
        ...element,
        children: element.children?.filter((childKey: string) =>
          elementKeys.has(childKey)
        )
      }
    ])
  )

  return {
    ...spec,
    elements
  }
}

type PartialSpecCompiler = ReturnType<typeof createSpecStreamCompiler>

function createCompiler(): PartialSpecCompiler {
  return createSpecStreamCompiler({
    root: '',
    elements: {}
  })
}

export type PartialSpecParser = {
  parse(source: string): Spec | null
  reset(): void
}

export function createPartialSpecParser(): PartialSpecParser {
  let compiler = createCompiler()
  let lastSource = ''

  return {
    parse(source: string): Spec | null {
      if (!source.trim()) {
        compiler = createCompiler()
        lastSource = ''
        return null
      }

      if (source === lastSource) {
        const result = migrateSpec(
          prunePartialSpec(compiler.getResult() as Spec)
        )
        return result.root ? result : null
      }

      if (source.startsWith(lastSource)) {
        compiler.push(source.slice(lastSource.length))
        lastSource = source
        const result = migrateSpec(
          prunePartialSpec(compiler.getResult() as Spec)
        )
        return result.root ? result : null
      }

      compiler = createCompiler()
      compiler.push(source)
      lastSource = source
      const result = migrateSpec(prunePartialSpec(compiler.getResult() as Spec))
      return result.root ? result : null
    },
    reset() {
      compiler = createCompiler()
      lastSource = ''
    }
  }
}

export function parseSpecBlock(source: string): Spec {
  // Apply legacy type migrations before catalog validation so that old
  // specs persisted in chat history can still validate against the current
  // catalog.
  const compiled = migrateSpec(compileSource(source))
  const validation = catalog.validate(compiled)

  if (!validation.success || !validation.data) {
    const issues = validation.error?.issues
      .map((issue: { message: string }) => issue.message)
      .join(', ')
    throw new Error(issues || 'Invalid spec block')
  }

  const validatedSpec = validation.data as Spec
  const specIssues = validateSpec(validatedSpec)
  if (!specIssues.valid) {
    throw new Error(formatSpecIssues(specIssues.issues))
  }

  return validatedSpec
}
