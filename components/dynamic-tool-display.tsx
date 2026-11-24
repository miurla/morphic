'use client'

import React from 'react'

import { toPublicErrorPayload } from '@/lib/errors/public-error'
import { localizePublicError } from '@/lib/i18n/errors'

import { useI18n } from '@/components/language-provider'

// This matches the structure from AI SDK v5
type DynamicToolPart =
  | {
      type: 'dynamic-tool'
      toolCallId: string
      toolName: string
      state: 'input-streaming'
      input: unknown
    }
  | {
      type: 'dynamic-tool'
      toolCallId: string
      toolName: string
      state: 'input-available'
      input: unknown
    }
  | {
      type: 'dynamic-tool'
      toolCallId: string
      toolName: string
      state: 'output-available'
      input: unknown
      output: unknown
    }
  | {
      type: 'dynamic-tool'
      toolCallId: string
      toolName: string
      state: 'output-error'
      input: unknown
      errorText: string
    }

interface DynamicToolDisplayProps {
  part: DynamicToolPart
}

export function DynamicToolDisplay({ part }: DynamicToolDisplayProps) {
  const { t, locale } = useI18n()

  // Extract tool type from name
  const getToolType = (toolName: string) => {
    if (toolName.startsWith('mcp__')) {
      return t('MCP Tool')
    } else if (toolName.startsWith('dynamic__')) {
      return t('Dynamic Tool')
    }
    return t('Custom Tool')
  }

  // Extract display name from tool name
  const getDisplayName = (toolName: string) => {
    if (toolName.startsWith('mcp__')) {
      return toolName.substring(5).replace(/__/g, '.')
    } else if (toolName.startsWith('dynamic__')) {
      return toolName.substring(9)
    }
    return toolName
  }

  const toolType = getToolType(part.toolName)
  const displayName = getDisplayName(part.toolName)
  const errorMessage =
    part.state === 'output-error'
      ? localizePublicError(
          toPublicErrorPayload(part.errorText, {
            fallbackMessage: 'Tool execution failed'
          }),
          locale
        ).error
      : undefined

  return (
    <div className="dynamic-tool-container rounded-lg border p-4 my-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {toolType}
        </span>
        <span className="text-sm font-semibold">{displayName}</span>
      </div>

      {/* Input display */}
      {(part.state === 'input-streaming' ||
        part.state === 'input-available' ||
        part.state === 'output-available' ||
        part.state === 'output-error') && (
        <div className="mb-2">
          <div className="text-xs text-muted-foreground mb-1">
            {t('Input:')}
          </div>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
            <code>{JSON.stringify(part.input, null, 2)}</code>
          </pre>
        </div>
      )}

      {/* Output display */}
      {part.state === 'output-available' && (
        <div className="mb-2">
          <div className="text-xs text-muted-foreground mb-1">
            {t('Output:')}
          </div>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
            <code>{JSON.stringify(part.output, null, 2)}</code>
          </pre>
        </div>
      )}

      {/* Error display */}
      {part.state === 'output-error' && (
        <div className="mb-2">
          <div className="text-xs text-destructive mb-1">{t('Error:')}</div>
          <div className="text-xs bg-destructive/10 text-destructive p-2 rounded">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Status indicator */}
      <div className="flex items-center gap-2 mt-2">
        <div
          className={`h-2 w-2 rounded-full ${
            part.state === 'input-streaming'
              ? 'bg-blue-500 animate-pulse'
              : part.state === 'input-available'
                ? 'bg-blue-500'
                : part.state === 'output-available'
                  ? 'bg-green-500'
                  : part.state === 'output-error'
                    ? 'bg-red-500'
                    : 'bg-gray-300'
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {part.state === 'input-streaming'
            ? t('Streaming...')
            : part.state === 'input-available'
              ? t('Processing...')
              : part.state === 'output-available'
                ? t('Complete')
                : part.state === 'output-error'
                  ? t('Failed')
                  : t('Unknown')}
        </span>
      </div>
    </div>
  )
}
