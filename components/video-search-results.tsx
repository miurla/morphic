/* eslint-disable @next/next/no-img-element */
'use client'

import { SerperSearchResultItem, SerperSearchResults } from '@/lib/types'

import { VideoResultGrid } from './video-result-grid'

export interface VideoSearchResultsProps {
  results: SerperSearchResults
  displayMode?: 'chat' | 'artifact'
}

// Utility function to ensure searchParameters are present
export function createVideoSearchResults(
  searchResults: any,
  query: string | undefined
): SerperSearchResults {
  return {
    ...searchResults,
    videos: searchResults.videos || [],
    searchParameters: searchResults.searchParameters || {
      q: query || '',
      type: 'video',
      engine: 'google'
    }
  }
}

export function VideoSearchResults({
  results,
  displayMode = 'chat'
}: VideoSearchResultsProps) {
  const videos = results.videos.filter((video: SerperSearchResultItem) => {
    try {
      return new URL(video.link).pathname === '/watch'
    } catch (e) {
      console.error('Invalid video URL:', video.link)
      return false
    }
  })

  const query = results.searchParameters?.q || ''

  if (!videos || videos.length === 0) {
    return <div className="text-muted-foreground">No videos found</div>
  }

  return (
    <VideoResultGrid videos={videos} query={query} displayMode={displayMode} />
  )
}
