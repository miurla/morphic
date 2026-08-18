import { type ExperimentResult, RegressionError } from '@langfuse/client'

export type Threshold = {
  direction: 'min' | 'max'
  value: number | null
}

export type GateCheck = {
  metric: string
  value: number
  threshold: Threshold
}

function violates(check: GateCheck): boolean {
  if (check.threshold.value === null) return false
  return check.threshold.direction === 'min'
    ? check.value < check.threshold.value
    : check.value > check.threshold.value
}

function formatCheck(check: GateCheck): string {
  const actual = check.value.toFixed(3)
  if (check.threshold.value === null) {
    return `  - ${check.metric}: ${actual} (not enforced)`
  }
  const comparator = check.threshold.direction === 'min' ? '>=' : '<='
  const verdict = violates(check) ? 'FAIL' : 'ok'
  return `  - ${check.metric}: ${actual} ${comparator} ${check.threshold.value} [${verdict}]`
}

/**
 * Compare measured metrics against the committed thresholds.
 *
 * Throws `RegressionError`, which the Langfuse experiment GitHub Action reads
 * to fail the job. Metrics with a null threshold are printed but never fail the
 * run, so a new metric can be observed for a while before it gates anything.
 */
export function applyGate(result: ExperimentResult, checks: GateCheck[]): void {
  console.log('\nGate:')
  for (const check of checks) {
    console.log(formatCheck(check))
  }

  const failures = checks.filter(violates)
  if (failures.length === 0) {
    const enforced = checks.filter(check => check.threshold.value !== null)
    console.log(
      enforced.length === 0
        ? '  no thresholds enforced yet'
        : `  ${enforced.length} threshold(s) passed`
    )
    return
  }

  const [first] = failures
  throw new RegressionError({
    result,
    metric: first.metric,
    value: first.value,
    threshold: first.threshold.value as number,
    message: failures
      .map(
        check =>
          `${check.metric}=${check.value.toFixed(3)} violates ${
            check.threshold.direction
          } ${check.threshold.value}`
      )
      .join(', ')
  })
}
