/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useMemo, useState } from 'react'

import { PlusCircle } from 'lucide-react'

import { SearchResultImage } from '@/lib/types'

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

interface SearchResultsImageSectionProps {
  images: SearchResultImage[]
  query?: string
  displayMode?: 'preview' | 'full'
}

type NormalizedImage = { url: string; description: string }

export const SearchResultsImageSection: React.FC<
  SearchResultsImageSectionProps
> = ({ images, query, displayMode = 'preview' }) => {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filteredImages, setFilteredImages] = useState<NormalizedImage[]>([])
  const [isCheckingImages, setIsCheckingImages] = useState(true)

  const convertedImages = useMemo(() => {
    if (!images || images.length === 0) {
      return [] as NormalizedImage[]
    }

    if (typeof images[0] === 'string') {
      return (images as string[]).map(image => ({
        url: image,
        description: ''
      }))
    }

    return images as NormalizedImage[]
  }, [images])

  useEffect(() => {
    let isMounted = true

    if (typeof window === 'undefined') {
      setFilteredImages(convertedImages)
      setIsCheckingImages(false)
      return
    }

    if (convertedImages.length === 0) {
      setFilteredImages([])
      setIsCheckingImages(false)
      return
    }

    setIsCheckingImages(true)
    setFilteredImages([])

    const preloadResults: (NormalizedImage | null)[] = Array(
      convertedImages.length
    ).fill(null)
    let completedChecks = 0

    const markComplete = () => {
      completedChecks += 1
      if (!isMounted) {
        return
      }
      if (completedChecks === convertedImages.length) {
        setFilteredImages(preloadResults.filter(Boolean) as NormalizedImage[])
        setIsCheckingImages(false)
      }
    }

    convertedImages.forEach((image, index) => {
      if (!image?.url) {
        markComplete()
        return
      }

      const preloader = new window.Image()
      preloader.onload = () => {
        if (!isMounted) {
          return
        }
        preloadResults[index] = image
        markComplete()
      }
      preloader.onerror = markComplete
      preloader.src = image.url
    })

    return () => {
      isMounted = false
    }
  }, [convertedImages])

  useEffect(() => {
    setSelectedIndex(prevIndex => {
      if (filteredImages.length === 0) {
        return 0
      }
      return Math.min(prevIndex, filteredImages.length - 1)
    })
  }, [filteredImages.length])

  // Update the current and count state when the carousel api is available
  useEffect(() => {
    if (!api) {
      return
    }

    // Set initial count from scroll snaps, current from selected snap
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap() + 1)

    const handleSelect = () => {
      setCurrent(api.selectedScrollSnap() + 1)
    }
    api.on('select', handleSelect)

    // Cleanup listener on unmount or when api changes
    return () => {
      api.off('select', handleSelect)
    }
  }, [api])

  // Update count based on the actual number of converted images
  // This ensures the count reflects the data, even if the carousel API is slow
  useEffect(() => {
    setCount(filteredImages.length)
  }, [filteredImages.length])

  useEffect(() => {
    if (filteredImages.length === 0) {
      setCurrent(0)
    }
  }, [filteredImages.length])

  // Scroll to the selected index when it changes or api becomes available
  useEffect(() => {
    if (api && filteredImages.length > 0) {
      const actualIndex = Math.min(
        selectedIndex,
        Math.max(0, filteredImages.length - 1) // Ensure index is not negative
      )
      api.scrollTo(actualIndex, false) // Use false for instant scroll on open
    }
    // Add convertedImages.length as dep: scroll might need adjustment if images load async
  }, [api, selectedIndex, filteredImages.length])

  // Early return AFTER all hooks if there are no images to display
  if (!isCheckingImages && filteredImages.length === 0) {
    return <div className="text-muted-foreground">No images found</div>
  }

  const handleImageError = (indexToRemove: number) => {
    setFilteredImages(prevImages =>
      prevImages.filter((_, imageIndex) => imageIndex !== indexToRemove)
    )
  }

  const baseImages = isCheckingImages ? convertedImages : filteredImages

  const renderImageGrid = (
    imageSubset: NormalizedImage[],
    gridClasses: string,
    startIndex: number = 0,
    isFullMode: boolean = false, // Add flag to indicate full mode for corner rounding
    isLoading: boolean = false
  ) => (
    <div className={gridClasses}>
      {imageSubset.map((image, index) => {
        const actualIndex = startIndex + index
        // Determine corner rounding based on index in full mode 2x3 layout
        let cornerClasses = '' // Default to no rounding
        if (isFullMode) {
          if (actualIndex === 0)
            cornerClasses = 'rounded-tl-lg' // Top-left
          else if (actualIndex === 1)
            cornerClasses = 'rounded-tr-lg' // Top-right
          else if (actualIndex === 2)
            cornerClasses = 'rounded-bl-lg' // Bottom-left
          // Index 3 (bottom-middle) gets no rounding
          else if (actualIndex === 4) cornerClasses = 'rounded-br-lg' // Bottom-right
        } else {
          cornerClasses = 'rounded-lg' // Default for preview mode
        }

        if (isLoading || !image?.url) {
          return (
            <div
              key={`placeholder-${startIndex}-${index}`}
              className="aspect-video"
            >
              <div
                className={`h-full w-full bg-muted animate-pulse shadow-sm ${cornerClasses}`}
              />
            </div>
          )
        }

        return (
          <Dialog key={actualIndex}>
            <DialogTrigger asChild>
              <div
                className="aspect-video cursor-pointer relative"
                onClick={() => setSelectedIndex(actualIndex)}
              >
                <div className="flex-1 h-full">
                  <div className="h-full w-full">
                    {image?.url ? (
                      <img
                        src={image.url}
                        alt={`Image ${actualIndex + 1}`}
                        // Apply specific or default rounding
                        className={`h-full w-full object-cover shadow-sm ${cornerClasses}`}
                        onError={() => handleImageError(actualIndex)}
                      />
                    ) : (
                      <div className="w-full h-full bg-muted animate-pulse rounded-sm" />
                    )}
                  </div>
                </div>
                {displayMode === 'preview' &&
                  actualIndex === 3 &&
                  !isLoading &&
                  filteredImages.length > 4 && (
                    <div className="absolute inset-0 bg-black/30 rounded-md flex items-center justify-center text-white/80 text-sm">
                      <PlusCircle size={24} />
                    </div>
                  )}
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Search Images</DialogTitle>
                <DialogDescription className="text-sm">
                  {query}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Carousel
                  setApi={setApi}
                  opts={{
                    startIndex: selectedIndex,
                    loop: filteredImages.length > 1
                  }}
                  className="w-full bg-muted max-h-[60vh]"
                >
                  <CarouselContent>
                    {filteredImages.map((img, idx) => (
                      <CarouselItem key={`${img.url}-${idx}`}>
                        <div className="p-1 flex items-center justify-center h-full">
                          <img
                            src={img.url}
                            alt={`Image ${idx + 1}`}
                            className="h-auto w-full object-contain max-h-[60vh]"
                            onError={() => handleImageError(idx)}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {filteredImages.length > 1 && (
                    <div className="absolute inset-8 flex items-center justify-between p-4">
                      <CarouselPrevious className="w-10 h-10 rounded-full shadow-sm focus:outline-hidden">
                        <span className="sr-only">Previous</span>
                      </CarouselPrevious>
                      <CarouselNext className="w-10 h-10 rounded-full shadow-sm focus:outline-hidden">
                        <span className="sr-only">Next</span>
                      </CarouselNext>
                    </div>
                  )}
                </Carousel>
                <div className="py-2 text-center text-sm text-muted-foreground">
                  {current} of {count}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )
      })}
    </div>
  )

  if (displayMode === 'full') {
    // Original 2 rows: 2 images + 3 images
    const firstRowImages = baseImages.slice(0, 2)
    const secondRowImages = baseImages.slice(2, 5)

    // Render two rows, passing isFullMode=true to apply specific rounding
    return (
      <div className="flex flex-col gap-2">
        {renderImageGrid(
          firstRowImages,
          'grid grid-cols-2 gap-2',
          0,
          true, // Pass true for isFullMode
          isCheckingImages
        )}
        {secondRowImages.length > 0 && // Only render second row if images exist
          renderImageGrid(
            secondRowImages,
            'grid grid-cols-3 gap-2',
            2,
            true, // Pass true for isFullMode
            isCheckingImages
          )}
      </div>
    )
  }

  // Default to preview mode (2x2 or 4 wide grid)
  const previewImages = baseImages.slice(0, 4)
  // Preview mode uses default rounding (rounded-lg), so isFullMode=false
  return renderImageGrid(
    previewImages,
    'grid grid-cols-2 md:grid-cols-4 gap-2',
    0,
    false,
    isCheckingImages
  )
}
