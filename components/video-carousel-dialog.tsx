'use client'

import { useEffect, useRef, useState } from 'react'

import { IconExternalLink, IconVolume } from '@tabler/icons-react'

import { SerperSearchResultItem } from '@/lib/types'

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

interface MediaParseResult {
  type: 'youtube' | 'vimeo' | 'video' | 'audio' | 'image' | 'generic'
  embedUrl?: string
  rawUrl?: string
}

function parseMediaLink(link: string): MediaParseResult {
  try {
    const url = new URL(link)
    const hostname = url.hostname.toLowerCase()
    const pathname = url.pathname

    // 1. YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      let videoId = ''
      if (hostname.includes('youtu.be')) {
        videoId = pathname.slice(1)
      } else if (pathname.includes('/shorts/')) {
        videoId = pathname.split('/shorts/')[1]?.split(/[?#]/)[0]
      } else if (pathname.includes('/embed/')) {
        videoId = pathname.split('/embed/')[1]?.split(/[?#]/)[0]
      } else {
        videoId = url.searchParams.get('v') || ''
      }
      if (videoId) {
        return {
          type: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1`
        }
      }
    }

    // 2. Vimeo
    if (hostname.includes('vimeo.com')) {
      const vimeoId = pathname.slice(1).split(/[?#]/)[0]
      if (vimeoId && /^\d+$/.test(vimeoId)) {
        return {
          type: 'vimeo',
          embedUrl: `https://player.vimeo.com/video/${vimeoId}`
        }
      }
    }

    // 3. Direct video extensions
    const extension = pathname.split('.').pop()?.toLowerCase() || ''
    if (['mp4', 'webm', 'ogg', 'mov', 'gifv'].includes(extension)) {
      return {
        type: 'video',
        rawUrl: link
      }
    }

    // 4. Direct audio extensions
    if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(extension)) {
      return {
        type: 'audio',
        rawUrl: link
      }
    }

    // 5. Direct image extensions (including GIFs)
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      return {
        type: 'image',
        rawUrl: link
      }
    }

    // 6. Generic link fallback
    return {
      type: 'generic',
      rawUrl: link
    }
  } catch {
    return {
      type: 'generic',
      rawUrl: link
    }
  }
}

interface VideoCarouselDialogProps {
  children: React.ReactNode
  videos: SerperSearchResultItem[]
  query: string
  initialIndex?: number // Add initialIndex prop
}

export function VideoCarouselDialog({
  children,
  videos,
  query,
  initialIndex = 0 // Default to 0
}: VideoCarouselDialogProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(initialIndex + 1)
  const videoRefs = useRef<(HTMLIFrameElement | null)[]>([])
  const previousIndexRef = useRef(initialIndex)

  useEffect(() => {
    if (!api) {
      return
    }

    const handleSelect = () => {
      const newIndex = api.selectedScrollSnap()
      const prevVideo = videoRefs.current[previousIndexRef.current]
      prevVideo?.contentWindow?.postMessage(
        '{"event":"command","func":"pauseVideo","args":""}',
        '*'
      )

      // Pause all direct HTML5 video and audio tags in the DOM
      try {
        const mediaElements = document.querySelectorAll('video, audio')
        mediaElements.forEach(el => {
          if (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement) {
            el.pause()
          }
        })
      } catch (e) {}

      previousIndexRef.current = newIndex
      setCurrent(newIndex + 1)
    }

    api.on('select', handleSelect)

    return () => {
      api.off('select', handleSelect)
    }
  }, [api])

  // Scroll to the initial index when the dialog opens and API is ready
  useEffect(() => {
    if (api) {
      previousIndexRef.current = initialIndex
      api.scrollTo(initialIndex, false) // Scroll instantly
    }
  }, [api, initialIndex])

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Search Videos</DialogTitle>
          <DialogDescription className="text-sm">{query}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Carousel
            setApi={nextApi => {
              previousIndexRef.current = initialIndex
              setCurrent((nextApi?.selectedScrollSnap() ?? initialIndex) + 1)
              setApi(nextApi)
            }}
            className="w-full bg-muted max-h-[60vh]"
            opts={{
              startIndex: initialIndex // Set initial slide
            }}
          >
            <CarouselContent>
              {videos.map((video, idx) => {
                const media = parseMediaLink(video.link)
                return (
                  <CarouselItem key={idx}>
                    <div className="p-1 flex items-center justify-center h-full w-full max-w-2xl mx-auto aspect-video">
                      {media.type === 'youtube' || media.type === 'vimeo' ? (
                        <iframe
                          ref={el => {
                            videoRefs.current[idx] = el
                          }}
                          src={media.embedUrl}
                          className="w-full h-full rounded-lg"
                          title={video.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : media.type === 'video' ? (
                        <video
                          src={media.rawUrl}
                          controls
                          className="w-full h-full object-contain rounded-lg bg-black"
                          poster={video.imageUrl}
                        />
                      ) : media.type === 'audio' ? (
                        <div className="flex flex-col items-center justify-center p-6 bg-card border rounded-lg w-full max-w-md mx-auto text-center gap-4">
                          {video.imageUrl ? (
                            <img
                              src={video.imageUrl}
                              alt={video.title}
                              className="w-24 h-24 object-cover rounded-md shadow-xs"
                              onError={e => {
                                (e.target as HTMLElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <IconVolume className="size-8" />
                            </div>
                          )}
                          <h3 className="font-semibold text-sm line-clamp-1">{video.title}</h3>
                          <audio src={media.rawUrl} controls className="w-full" />
                          <p className="text-xs text-muted-foreground line-clamp-2">{video.snippet}</p>
                        </div>
                      ) : media.type === 'image' ? (
                        <div className="flex flex-col items-center justify-center p-4 bg-black/5 rounded-lg w-full h-full relative">
                          <img
                            src={media.rawUrl}
                            alt={video.title}
                            className="max-w-full max-h-[50vh] object-contain rounded-lg"
                          />
                          <p className="mt-2 text-xs text-center text-muted-foreground line-clamp-1">{video.title}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 bg-card border rounded-lg w-full max-w-md mx-auto text-center gap-4">
                          {video.imageUrl && (
                            <img
                              src={video.imageUrl}
                              alt={video.title}
                              className="w-full aspect-video object-cover rounded-md shadow-xs"
                              onError={e => {
                                (e.target as HTMLElement).style.display = 'none'
                              }}
                            />
                          )}
                          <h3 className="font-semibold text-sm line-clamp-1">{video.title}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">{video.snippet}</p>
                          <a
                            href={video.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-full text-xs font-semibold hover:opacity-90 transition-opacity"
                          >
                            Watch/Listen on original site
                            <IconExternalLink className="size-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </CarouselItem>
                )
              })}
            </CarouselContent>
            <div className="absolute inset-8 flex items-center justify-between p-4 pointer-events-none">
              <CarouselPrevious className="w-10 h-10 rounded-full shadow-sm focus:outline-hidden pointer-events-auto">
                <span className="sr-only">Previous</span>
              </CarouselPrevious>
              <CarouselNext className="w-10 h-10 rounded-full shadow-sm focus:outline-hidden pointer-events-auto">
                <span className="sr-only">Next</span>
              </CarouselNext>
            </div>
          </Carousel>
          <div className="py-2">
            <div className="text-center text-sm text-muted-foreground">
              {current} of {videos.length}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
