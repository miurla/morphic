'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { SerperSearchResultItem } from '@/lib/types'
import { PlusCircle } from 'lucide-react'
import Image from 'next/image'
import { VideoCarouselDialog } from './video-carousel-dialog'

interface VideoResultGridProps {
  videos: SerperSearchResultItem[]
  query: string
  displayMode: 'chat' | 'artifact'
}

export function VideoResultGrid({
  videos,
  query,
  displayMode
}: VideoResultGridProps) {
  const containerClasses =
    displayMode === 'chat'
      ? 'flex flex-wrap'
      : 'grid grid-cols-1 sm:grid-cols-2 gap-4'

  const itemsToMap = displayMode === 'chat' ? videos.slice(0, 4) : videos

  return (
    <div className={containerClasses}>
      {itemsToMap.map((video, index) => {
        const baseUrl = video.imageUrl ? video.imageUrl.split('?')[0] : ''
        const showOverlay =
          displayMode === 'chat' && index === 3 && videos.length > 4
        const cardClasses = displayMode === 'chat' ? 'w-1/2 md:w-1/4 p-1' : ''

        return (
          <VideoCarouselDialog
            key={video.link || index}
            videos={videos} // Pass all filtered videos for the dialog
            query={query}
            initialIndex={index}
          >
            <div className={`relative cursor-pointer ${cardClasses}`}>
              <Card className="flex-1 min-h-40 overflow-hidden rounded-lg border hover:shadow-sm transition-shadow duration-200">
                <CardContent className="p-0">
                  {' '}
                  {/* Adjusted padding */}
                  {baseUrl && (
                    <div className="relative w-full aspect-video bg-muted">
                      <Image
                        src={baseUrl}
                        alt={`Thumbnail for ${video.title}`}
                        fill
                        sizes={
                          displayMode === 'chat'
                            ? '(max-width: 768px) 50vw, 25vw'
                            : '(max-width: 639px) 300px, 250px'
                        } // Different sizes per mode
                        className="object-cover"
                        priority={index < 4}
                        onError={e => {
                          const target = e.target as HTMLImageElement
                          target.src = '/images/placeholder-image.png'
                        }}
                      />
                    </div>
                  )}
                  <div className="p-2">
                    {' '}
                    {/* Inner padding for text */}
                    <p className="text-xs line-clamp-2 mb-1 font-semibold">
                      {video.title}
                    </p>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-4 w-4">
                        <AvatarImage
                          src={`https://www.google.com/s2/favicons?domain=${
                            new URL(video.link).hostname
                          }`}
                          alt={video.channel || video.source}
                        />
                        <AvatarFallback>
                          {new URL(video.link).hostname[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-xs text-muted-foreground opacity-60 truncate">
                        {/* Display channel or source if available */}
                        {video.channel ||
                          video.source ||
                          new URL(video.link).hostname}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {showOverlay && (
                <div className="absolute inset-0 bg-black/30 rounded-md flex items-center justify-center text-white/80 text-sm">
                  <PlusCircle size={24} />
                </div>
              )}
            </div>
          </VideoCarouselDialog>
        )
      })}
    </div>
  )
}
