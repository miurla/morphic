'use client'

import { cn } from '@/lib/utils'
import {
  PmcResearchArticle,
  PmcResearchResultResponse
} from '@/types/pmc_research'
import { BotMessage } from './message' // Using BotMessage for Markdown rendering
import { IconLogo } from './ui/icons'

interface PmcResultDisplayProps {
  data: PmcResearchResultResponse
}

export default function PmcResultDisplay({ data }: PmcResultDisplayProps) {
  return (
    <div className={cn('group relative mb-4 flex items-start')}>
      {/* Icon */}
      <div className="flex size-[25px] shrink-0 select-none items-center justify-center rounded-md border bg-background shadow-sm mr-4">
        <IconLogo />
      </div>

      {/* Content Area */}
      <div className="flex-1 space-y-4 overflow-hidden px-1">
        {/* Query Display */}
        <p className="text-sm font-semibold text-muted-foreground">
          Resultados da Pesquisa PMC para: "{data.query}"
        </p>

        {/* Summary Section */}
        {data.summary && (
          <div className="space-y-2">
            <h3 className="text-md font-semibold">Sumário</h3>
            <BotMessage message={data.summary} className="text-sm" />
          </div>
        )}

        {/* Markdown Report Section */}
        {data.markdown_report && (
          <div className="space-y-2">
            <h3 className="text-md font-semibold">Relatório Detalhado</h3>
            {/* Use BotMessage which should handle Markdown */}
            <BotMessage message={data.markdown_report} className="text-sm" />
          </div>
        )}

        {/* Articles Section */}
        {data.articles && data.articles.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-md font-semibold">
              Artigos Consultados ({data.articles.length})
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {data.articles.map(
                (article: PmcResearchArticle, index: number) => (
                  <li key={index}>
                    {article.title}
                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:underline text-xs"
                      >
                        [Link]
                      </a>
                    )}
                    {article.summary && (
                      <p className="text-xs text-muted-foreground pl-2 pt-0.5">
                        {/* Displaying article summary directly */}
                        {article.summary}
                      </p>
                    )}
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        {/* Fallback if no structured content */}
        {!data.summary &&
          !data.markdown_report &&
          (!data.articles || data.articles.length === 0) && (
            <p className="text-sm text-muted-foreground">
              {data.message || 'Nenhum resultado detalhado encontrado.'}
            </p>
          )}
      </div>
    </div>
  )
}
