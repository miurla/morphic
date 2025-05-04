/* eslint-disable @next/next/no-img-element */
'use client'

import { SerperSearchResultItem, SerperSearchResults } from '@/lib/types'
import { VideoResultGrid } from './video-result-grid'

export interface VideoSearchResultsProps {
  results: SerperSearchResults
}

export function VideoSearchResults({ results }: VideoSearchResultsProps) {
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

  return <VideoResultGrid videos={videos} query={query} displayMode="chat" />
}
