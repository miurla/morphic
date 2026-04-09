'use client'

import { useMemo, useState } from 'react'

import { createSpecFenceEvaluator } from '@/lib/render/spec-fence'

import { SpecBlock } from '@/components/spec-block'

type SpecFenceBlockProps = {
  source: string
  complete: boolean
  showErrors?: boolean
}

export function SpecFenceBlock({
  source,
  complete,
  showErrors = true
}: SpecFenceBlockProps) {
  const [evaluator] = useState(() => createSpecFenceEvaluator())
  const result = useMemo(
    () =>
      evaluator.evaluate({
        source,
        complete,
        showErrors
      }),
    [complete, evaluator, showErrors, source]
  )

  return <SpecBlock result={result} />
}
