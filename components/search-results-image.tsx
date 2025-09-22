/* eslint-disable @next/next/no-img-element */
'use client'

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

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

type NormalizedImage = { id: string; url: string; description: string }

type FilterStatus = 'loading' | 'ready' | 'empty'

interface FilteredImagesState {
  status: FilterStatus
  images: NormalizedImage[]
}

const normalizeImages = (images: SearchResultImage[]): NormalizedImage[] => {
  if (!images || images.length === 0) {
    return []
  }

  return images.map((image, index) => {
    if (typeof image === 'string') {
      return {
        id: `${index}-${image}`,
        url: image,
        description: ''
      }
    }

    const url = image.url ?? ''
    return {
      id: `${index}-${url}`,
      url,
      description: image.description ?? ''
    }
  })
}

const useFilteredImages = (images: SearchResultImage[]) => {
  const normalizedImages = useMemo(() => normalizeImages(images), [images])

  const [state, setState] = useState<FilteredImagesState>(() => ({
    status: normalizedImages.length === 0 ? 'empty' : 'loading',
    images: []
  }))

  useEffect(() => {
    if (normalizedImages.length === 0) {
      setState({ status: 'empty', images: [] })
      return
    }

    if (typeof window === 'undefined') {
      setState({ status: 'ready', images: normalizedImages })
      return
    }

    let cancelled = false
    setState({ status: 'loading', images: [] })

    const preloadImage = (image: NormalizedImage) =>
      new Promise<NormalizedImage | null>(resolve => {
        if (!image.url) {
          resolve(null)
          return
        }

        const img = new window.Image()
        img.onload = () => resolve(image)
        img.onerror = () => resolve(null)
        img.src = image.url
      })

    Promise.all(normalizedImages.map(preloadImage)).then(results => {
      if (cancelled) {
        return
      }

      const validImages = results.filter(Boolean) as NormalizedImage[]
      if (validImages.length === 0) {
        setState({ status: 'empty', images: [] })
        return
      }

      setState({ status: 'ready', images: validImages })
    })

    return () => {
      cancelled = true
    }
  }, [normalizedImages])

  const removeImage = useCallback((id: string) => {
    setState(prevState => {
      if (prevState.status === 'loading') {
        return prevState
      }

      const remaining = prevState.images.filter(image => image.id !== id)
      return {
        status: remaining.length === 0 ? 'empty' : 'ready',
        images: remaining
      }
    })
  }, [])

  const displayImages =
    state.status === 'loading' ? normalizedImages : state.images

  return {
    status: state.status,
    filteredImages: state.images,
    displayImages,
    removeImage
  }
}

const useCarouselMetrics = ({
  api,
  imageCount,
  selectedIndex,
  setSelectedIndex
}: {
  api: CarouselApi | undefined
  imageCount: number
  selectedIndex: number
  setSelectedIndex: Dispatch<SetStateAction<number>>
}) => {
  const [current, setCurrent] = useState(() =>
    imageCount > 0 ? Math.min(selectedIndex + 1, imageCount) : 0
  )

  useEffect(() => {
    if (!api) {
      if (imageCount === 0) {
        setCurrent(0)
      } else {
        setCurrent(Math.min(selectedIndex + 1, imageCount))
      }
      return
    }

    const handleSelect = () => {
      setCurrent(api.selectedScrollSnap() + 1)
    }

    handleSelect()
    api.on('select', handleSelect)

    return () => {
      api.off('select', handleSelect)
    }
  }, [api, imageCount, selectedIndex])

  useEffect(() => {
    setSelectedIndex(prevIndex => {
      if (imageCount === 0) {
        return 0
      }
      return Math.min(prevIndex, imageCount - 1)
    })
  }, [imageCount, setSelectedIndex])

  useEffect(() => {
    if (!api || imageCount === 0) {
      if (imageCount === 0) {
        setCurrent(0)
      }
      return
    }

    const clampedIndex = Math.min(selectedIndex, imageCount - 1)
    api.scrollTo(clampedIndex, false)
  }, [api, selectedIndex, imageCount])

  return { current }
}

const cornerClassForIndex = (actualIndex: number, isFullMode: boolean) => {
  if (!isFullMode) {
    return 'rounded-lg'
  }

  if (actualIndex === 0) return 'rounded-tl-lg'
  if (actualIndex === 1) return 'rounded-tr-lg'
  if (actualIndex === 2) return 'rounded-bl-lg'
  if (actualIndex === 4) return 'rounded-br-lg'

  return ''
}

export const SearchResultsImageSection: React.FC<
  SearchResultsImageSectionProps
> = ({ images, query, displayMode = 'preview' }) => {
  const [api, setApi] = useState<CarouselApi>()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const { status, filteredImages, displayImages, removeImage } =
    useFilteredImages(images)

  const filteredCount = filteredImages.length
  const isLoading = status === 'loading'

  const { current } = useCarouselMetrics({
    api,
    imageCount: filteredCount,
    selectedIndex,
    setSelectedIndex
  })

  if (status === 'empty') {
    return <div className="text-muted-foreground">No images found</div>
  }

  const handleSelect = (index: number) => {
    if (!isLoading) {
      setSelectedIndex(index)
    }
  }

  const renderImageGrid = (
    imageSubset: NormalizedImage[],
    gridClasses: string,
    startIndex: number = 0,
    isFullMode: boolean = false
  ) => (
    <div className={gridClasses}>
      {imageSubset.map((image, index) => {
        const actualIndex = startIndex + index
        const cornerClasses = cornerClassForIndex(actualIndex, isFullMode)

        if (isLoading || !image.url) {
          return (
            <div key={image.id} className="aspect-video">
              <div
                className={`h-full w-full bg-muted animate-pulse shadow-sm ${cornerClasses}`}
              />
            </div>
          )
        }

        const showPreviewOverlay =
          displayMode === 'preview' && actualIndex === 3 && filteredCount > 4

        return (
          <Dialog key={image.id}>
            <DialogTrigger asChild>
              <div
                className="aspect-video cursor-pointer relative"
                onClick={() => handleSelect(actualIndex)}
              >
                <div className="flex-1 h-full">
                  <div className="h-full w-full">
                    <img
                      src={image.url}
                      alt={`Image ${actualIndex + 1}`}
                      className={`h-full w-full object-cover shadow-sm ${cornerClasses}`}
                      onError={() => removeImage(image.id)}
                    />
                  </div>
                </div>
                {!isLoading && showPreviewOverlay && (
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
                    loop: filteredCount > 1
                  }}
                  className="w-full bg-muted max-h-[60vh]"
                >
                  <CarouselContent>
                    {filteredImages.map((img, idx) => (
                      <CarouselItem key={img.id}>
                        <div className="p-1 flex items-center justify-center h-full">
                          <img
                            src={img.url}
                            alt={`Image ${idx + 1}`}
                            className="h-auto w-full object-contain max-h-[60vh]"
                            onError={() => removeImage(img.id)}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {filteredCount > 1 && (
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
                  {current} of {filteredCount}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )
      })}
    </div>
  )

  if (displayMode === 'full') {
    const firstRowImages = displayImages.slice(0, 2)
    const secondRowImages = displayImages.slice(2, 5)

    return (
      <div className="flex flex-col gap-2">
        {renderImageGrid(firstRowImages, 'grid grid-cols-2 gap-2', 0, true)}
        {secondRowImages.length > 0 &&
          renderImageGrid(secondRowImages, 'grid grid-cols-3 gap-2', 2, true)}
      </div>
    )
  }

  const previewImages = displayImages.slice(0, 4)
  return renderImageGrid(previewImages, 'grid grid-cols-2 md:grid-cols-4 gap-2')
}
