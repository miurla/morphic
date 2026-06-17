'use client'

import type { ToolPart } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { NativeIcon } from '@/components/native/native-icon'

import { CollapsibleMessage } from './collapsible-message'
import ProcessHeader from './process-header'

interface ResearchSubtaskSectionProps {
  tool: ToolPart<'researchSubtask'>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

export function ResearchSubtaskSection({
  tool,
  isOpen,
  onOpenChange,
  borderless = false,
  isFirst = false,
  isLast = false
}: ResearchSubtaskSectionProps) {
  const isLoading =
    tool.state === 'input-streaming' || tool.state === 'input-available'
  const isDone = tool.state === 'output-available'
  const isError = tool.state === 'output-error'
  const output = tool.output as
    | {
        agentId?: string
        agentRole?: string
        model?: string
        parentModel?: string
        routing?: string
        skippedDuplicate?: boolean
        duplicateOf?: string
        notes?: string
      }
    | undefined
  const metadataItems = [
    ['Role', output?.agentRole],
    ['Agent', output?.agentId],
    ['Model', output?.model],
    ['Parent', output?.parentModel],
    ['Route', output?.routing]
  ].filter((item): item is [string, string] => Boolean(item[1]))

  const taskLabel = tool.input?.task
    ? `Researching: ${tool.input.task}`
    : 'Delegating research sub-task...'

  const header = (
    <ProcessHeader
      isLoading={isLoading}
      label={
        <span className="inline-flex items-center gap-2 min-w-0 overflow-hidden">
          <NativeIcon
            name="bot"
            className="size-4 text-muted-foreground shrink-0"
          />
          <span className="truncate">
            {isDone
              ? tool.output?.task
                ? `Researched: ${tool.output.task}`
                : 'Sub-task complete'
              : isError
                ? 'Sub-task failed'
                : taskLabel}
          </span>
        </span>
      }
      meta={
        isDone ? (
          <NativeIcon name="checkCircle" className="size-4 text-green-500" />
        ) : undefined
      }
      ariaExpanded={isOpen}
    />
  )

  return (
    <div className="relative">
      {borderless && (
        <>
          {!isFirst && (
            <div className="absolute left-[19.5px] w-px bg-border h-2 top-0" />
          )}
          {!isLast && (
            <div className="absolute left-[19.5px] w-px bg-border h-2 bottom-0" />
          )}
        </>
      )}
      <CollapsibleMessage
        role="assistant"
        isCollapsible={isDone || isError}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showBorder={!borderless}
        showIcon={false}
        variant="default"
        showSeparator={false}
        headerClickBehavior="split"
      >
        <div className="flex">
          {borderless && (
            <>
              <div className="w-[16px] shrink-0 flex justify-center">
                <div
                  className={cn(
                    'w-px bg-border/50 transition-opacity duration-200',
                    isOpen ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{
                    marginTop: isFirst ? '0' : '-1rem',
                    marginBottom: isLast ? '0' : '-1rem'
                  }}
                />
              </div>
              <div className="w-2 shrink-0" />
            </>
          )}
          <div className="flex-1 px-3 pb-3 text-sm text-muted-foreground">
            {isDone && output ? (
              <div className="space-y-2">
                {output.skippedDuplicate && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-foreground">
                      Skipped
                    </span>
                    {output.duplicateOf && (
                      <span>Duplicate of {output.duplicateOf}</span>
                    )}
                  </div>
                )}
                {metadataItems.length > 0 && (
                  <dl className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-relaxed">
                    {metadataItems.map(([label, value]) => (
                      <div key={label} className="flex min-w-0 gap-1">
                        <dt className="text-muted-foreground/80">{label}:</dt>
                        <dd className="min-w-0 break-all text-foreground/80">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {output.notes && (
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-xs leading-relaxed">
                    {output.notes}
                  </div>
                )}
              </div>
            ) : isError ? (
              <p className="text-xs text-destructive">
                Sub-task research failed.
                {tool.errorText ? ` ${tool.errorText}` : ''}
              </p>
            ) : null}
          </div>
        </div>
      </CollapsibleMessage>
    </div>
  )
}
