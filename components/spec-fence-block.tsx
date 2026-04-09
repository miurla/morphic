'use client'

import { useMemo, useState } from 'react'

import { createSpecFenceEvaluator } from '@/lib/render/spec-fence'

import { SpecBlock } from '@/components/spec-block'

export function SpecFenceBlock({ source }: { source: string }) {
  const [evaluator] = useState(() => createSpecFenceEvaluator())
  const result = useMemo(() => evaluator.evaluate(source), [evaluator, source])

  return <SpecBlock result={result} />
}
