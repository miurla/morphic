'use client'

import type {
  ClaimSupportStatus,
  ClaimVerificationResult
} from '@/lib/claims/evidence-verification'
import { cn } from '@/lib/utils'

import { GuardedExternalLink } from '@/components/navigation/guarded-external-link'

interface EvidencePanelProps {
  result: ClaimVerificationResult
}

const STATUS_LABELS: Record<ClaimSupportStatus, string> = {
  contradicted: 'Contradicted',
  partially_supported: 'Partial',
  supported: 'Supported',
  unavailable: 'Unavailable',
  uncited: 'Uncited'
}

const STATUS_CLASSES: Record<ClaimSupportStatus, string> = {
  contradicted: 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300',
  partially_supported:
    'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  supported:
    'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  unavailable: 'border-muted-foreground/20 bg-muted/40 text-muted-foreground',
  uncited:
    'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300'
}

function issueCount(result: ClaimVerificationResult) {
  return result.claims.filter(
    claim =>
      claim.supportStatus === 'contradicted' ||
      claim.supportStatus === 'unavailable' ||
      claim.supportStatus === 'uncited'
  ).length
}

function formatIssueCount(count: number) {
  return count === 1 ? '1 issue' : `${count} issues`
}

function evidenceTypeLabel(evidenceType?: 'citation' | 'fact_check_review') {
  return evidenceType === 'fact_check_review' ? 'Fact-check review' : 'Citation'
}

export function EvidencePanel({ result }: EvidencePanelProps) {
  if (result.status === 'failed') {
    return (
      <section className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
        <div className="font-medium text-amber-700 dark:text-amber-300">
          Evidence check unavailable
        </div>
        {result.error ? (
          <p className="mt-1 text-xs text-muted-foreground">{result.error}</p>
        ) : null}
      </section>
    )
  }

  if (result.claims.length === 0) {
    return null
  }

  const issues = issueCount(result)

  return (
    <section className="rounded-md border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-foreground">
            Evidence checked
          </h2>
          <p className="text-xs text-muted-foreground">
            Snippet-level support check for cited claims.
          </p>
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs',
            issues > 0
              ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300'
              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
          )}
        >
          {formatIssueCount(issues)}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {result.claims.map(claim => (
          <article
            key={claim.id}
            aria-label={claim.text}
            className="rounded-md border bg-background p-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground">
                {claim.text}
              </p>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 text-[11px]',
                  STATUS_CLASSES[claim.supportStatus]
                )}
              >
                {STATUS_LABELS[claim.supportStatus]}
              </span>
            </div>

            {claim.evidence.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {claim.evidence.map((evidence, index) => (
                  <div
                    key={`${claim.id}-${evidence.sourceUrl ?? index}`}
                    className="space-y-1 rounded border bg-muted/30 px-2 py-1.5"
                  >
                    <div className="text-[11px] font-medium uppercase text-muted-foreground">
                      {evidenceTypeLabel(evidence.evidenceType)}
                    </div>
                    {evidence.sourceUrl ? (
                      <GuardedExternalLink
                        href={evidence.sourceUrl}
                        target="_blank"
                        className="block truncate text-xs font-medium underline-offset-4 hover:underline"
                      >
                        {evidence.sourceTitle || evidence.sourceUrl}
                      </GuardedExternalLink>
                    ) : null}
                    {evidence.quote ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {evidence.quote}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
