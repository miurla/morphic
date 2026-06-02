'use client'

import { useState } from 'react'

import { SearchResultItem } from '@/lib/types'
import { displayUrlName } from '@/lib/utils/domain'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { GuardedExternalLink } from '@/components/navigation/guarded-external-link'

export interface SearchResultsProps {
  results: SearchResultItem[]
  displayMode?: 'grid' | 'list'
}

export function SearchResults({
  results,
  displayMode = 'grid'
}: SearchResultsProps) {
  // State to manage whether to display the results
  const [showAllResults, setShowAllResults] = useState(false)

  const handleViewMore = () => {
    setShowAllResults(true)
  }

  // Logic for grid mode
  const displayedGridResults = showAllResults ? results : results.slice(0, 3)
  const additionalResultsCount = results.length > 3 ? results.length - 3 : 0

  // --- List Mode Rendering ---
  if (displayMode === 'list') {
    return (
      <div className="flex flex-col gap-2">
        {results.map((result, index) => (
          <GuardedExternalLink
            href={result.url}
            key={index}
            target="_blank"
            className="block"
          >
            <Card className="w-full hover:bg-muted/50 transition-colors">
              <CardContent className="p-2 flex items-start space-x-2">
                <Avatar className="h-4 w-4 mt-1 shrink-0">
                  <AvatarImage
                    src={`https://www.google.com/s2/favicons?domain=${
                      new URL(result.url).hostname
                    }`}
                    alt={new URL(result.url).hostname}
                  />
                  <AvatarFallback className="text-xs">
                    {new URL(result.url).hostname[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="grow overflow-hidden space-y-0.5">
                  <p className="text-sm font-medium line-clamp-1">
                    {result.title || new URL(result.url).pathname}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {result.content}
                  </p>
                  <div className="text-xs text-muted-foreground/80 mt-1 truncate">
                    <span className="underline">
                      {new URL(result.url).hostname}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </GuardedExternalLink>
        ))}
      </div>
    )
  }

  // --- Grid Mode Rendering (Existing Logic) ---
  return (
    <div className="flex flex-col gap-1 md:-m-1 md:flex-row md:flex-wrap md:gap-0">
      {displayedGridResults.map((result, index) => (
        <div className="min-w-0 md:w-1/4 md:p-1" key={index}>
          <GuardedExternalLink href={result.url} target="_blank">
            <Card className="h-full flex-1 rounded-md hover:bg-muted/50 transition-colors">
              <CardContent className="flex h-full min-w-0 items-center justify-between gap-2 p-2 md:flex-col md:items-stretch">
                <p className="min-w-0 flex-1 line-clamp-1 text-xs md:min-h-8 md:line-clamp-2">
                  {result.title || result.content}
                </p>
                <div className="flex max-w-[42%] shrink-0 items-center space-x-1 min-w-0 md:mt-2 md:max-w-full md:shrink">
                  <Avatar className="h-4 w-4 shrink-0">
                    <AvatarImage
                      src={`https://www.google.com/s2/favicons?domain=${
                        new URL(result.url).hostname
                      }`}
                      alt={new URL(result.url).hostname}
                    />
                    <AvatarFallback>
                      {new URL(result.url).hostname[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-xs opacity-60 truncate min-w-0">
                    {displayUrlName(result.url)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </GuardedExternalLink>
        </div>
      ))}
      {!showAllResults && additionalResultsCount > 0 && (
        <>
          <div className="flex justify-center py-1 md:hidden">
            <Button
              variant="link"
              className="h-auto px-2 py-1 text-muted-foreground"
              onClick={handleViewMore}
            >
              View {additionalResultsCount} more
            </Button>
          </div>
          <div className="hidden md:block md:w-1/4 md:p-1">
            <Card className="flex h-full flex-1 items-center justify-center">
              <CardContent className="p-2">
                <Button
                  variant="link"
                  className="text-muted-foreground"
                  onClick={handleViewMore}
                >
                  View {additionalResultsCount} more
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
