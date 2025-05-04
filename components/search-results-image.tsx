/* eslint-disable @next/next/no-img-element */
'use client'

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
import { SearchResultImage } from '@/lib/types'
import { PlusCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

interface SearchResultsImageSectionProps {
  images: SearchResultImage[]
  query?: string
  displayMode?: 'preview' | 'full'
}

export const SearchResultsImageSection: React.FC<
  SearchResultsImageSectionProps
> = ({ images, query, displayMode = 'preview' }) => {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Calculate convertedImages first, before any hooks that might depend on it or early returns
  let convertedImages: { url: string; description: string }[] = []
  if (images && images.length > 0) {
    // Check images array before accessing its elements
    if (typeof images[0] === 'string') {
      convertedImages = (images as string[]).map(image => ({
        url: image,
        description: ''
      }))
    } else {
      convertedImages = images as { url: string; description: string }[]
    }
  }

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
    setCount(convertedImages.length)
  }, [convertedImages.length])

  // Scroll to the selected index when it changes or api becomes available
  useEffect(() => {
    if (api && convertedImages.length > 0) {
      const actualIndex = Math.min(
        selectedIndex,
        Math.max(0, convertedImages.length - 1) // Ensure index is not negative
      )
      api.scrollTo(actualIndex, false) // Use false for instant scroll on open
    }
    // Add convertedImages.length as dep: scroll might need adjustment if images load async
  }, [api, selectedIndex, convertedImages.length])

  // Early return AFTER all hooks if there are no images to display
  if (convertedImages.length === 0) {
    return <div className="text-muted-foreground">No images found</div>
  }

  const renderImageGrid = (
    imageSubset: { url: string; description: string }[],
    gridClasses: string,
    startIndex: number = 0,
    isFullMode: boolean = false // Add flag to indicate full mode for corner rounding
  ) => (
    <div className={gridClasses}>
      {imageSubset.map((image, index) => {
        const actualIndex = startIndex + index
        // Determine corner rounding based on index in full mode 2x3 layout
        let cornerClasses = '' // Default to no rounding
        if (isFullMode) {
          if (actualIndex === 0) cornerClasses = 'rounded-tl-lg' // Top-left
          else if (actualIndex === 1)
            cornerClasses = 'rounded-tr-lg' // Top-right
          else if (actualIndex === 2)
            cornerClasses = 'rounded-bl-lg' // Bottom-left
          // Index 3 (bottom-middle) gets no rounding
          else if (actualIndex === 4) cornerClasses = 'rounded-br-lg' // Bottom-right
        } else {
          cornerClasses = 'rounded-lg' // Default for preview mode
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
                    {image ? (
                      <img
                        src={image.url}
                        alt={`Image ${actualIndex + 1}`}
                        // Apply specific or default rounding
                        className={`h-full w-full object-cover shadow ${cornerClasses}`}
                        onError={e =>
                          (e.currentTarget.src =
                            '/images/placeholder-image.png')
                        }
                      />
                    ) : (
                      <div className="w-full h-full bg-muted animate-pulse rounded-sm" />
                    )}
                  </div>
                </div>
                {displayMode === 'preview' &&
                  actualIndex === 3 &&
                  convertedImages.length > 4 && (
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
                    loop: convertedImages.length > 1
                  }}
                  className="w-full bg-muted max-h-[60vh]"
                >
                  <CarouselContent>
                    {convertedImages.map((img, idx) => (
                      <CarouselItem key={idx}>
                        <div className="p-1 flex items-center justify-center h-full">
                          <img
                            src={img.url}
                            alt={`Image ${idx + 1}`}
                            className="h-auto w-full object-contain max-h-[60vh]"
                            onError={e =>
                              (e.currentTarget.src =
                                '/images/placeholder-image.png')
                            }
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {convertedImages.length > 1 && (
                    <div className="absolute inset-8 flex items-center justify-between p-4">
                      <CarouselPrevious className="w-10 h-10 rounded-full shadow focus:outline-none">
                        <span className="sr-only">Previous</span>
                      </CarouselPrevious>
                      <CarouselNext className="w-10 h-10 rounded-full shadow focus:outline-none">
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
    const firstRowImages = convertedImages.slice(0, 2)
    const secondRowImages = convertedImages.slice(2, 5)

    // Render two rows, passing isFullMode=true to apply specific rounding
    return (
      <div className="flex flex-col gap-2">
        {renderImageGrid(
          firstRowImages,
          'grid grid-cols-2 gap-2',
          0,
          true // Pass true for isFullMode
        )}
        {secondRowImages.length > 0 && // Only render second row if images exist
          renderImageGrid(
            secondRowImages,
            'grid grid-cols-3 gap-2',
            2,
            true // Pass true for isFullMode
          )}
      </div>
    )
  }

  // Default to preview mode (2x2 or 4 wide grid)
  const previewImages = convertedImages.slice(0, 4)
  // Preview mode uses default rounding (rounded-lg), so isFullMode=false
  return renderImageGrid(
    previewImages,
    'grid grid-cols-2 md:grid-cols-4 gap-2',
    0,
    false
  )
}
