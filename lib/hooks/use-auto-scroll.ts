import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'

interface UseAutoScrollOptions {
  /** Value that changes when the content updates (e.g. messages.length) */
  dependency: number
  /** Whether content is currently loading */
  isLoading: boolean
  /** Whether content is currently streaming */
  isStreaming: boolean
  /** The container element to scroll (window if undefined) */
  scrollContainer?: React.RefObject<HTMLElement>
  /** Threshold in pixels from bottom to consider "at bottom" (default: 60) */
  threshold?: number
}

interface UseAutoScrollReturn {
  /** Reference to place at the bottom of your content for scroll targeting */
  anchorRef: React.RefObject<HTMLDivElement>
  /** Whether auto-scrolling is currently enabled */
  isAutoScroll: boolean
  /** Function to manually enable auto-scrolling */
  enable: () => void
}

/**
 * Hook that provides auto-scrolling functionality with user override detection.
 */
export function useAutoScroll({
  dependency,
  isLoading,
  isStreaming,
  scrollContainer,
  threshold = 70
}: UseAutoScrollOptions): UseAutoScrollReturn {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const autoScrollIsEnabledRef = useRef(true) // Ref to mirror isAutoScroll for sync checks
  const intervalRef = useRef<NodeJS.Timeout | undefined>() // Ref to hold the interval ID

  // Sync ref with state
  useEffect(() => {
    autoScrollIsEnabledRef.current = isAutoScroll
  }, [isAutoScroll])

  // Detect when user scrolls away from bottom
  const handleScroll = useCallback(() => {
    // Calculate distance from bottom of scroll container (synchronously)
    let pixelsFromBottom = 0
    if (scrollContainer?.current) {
      const element = scrollContainer.current
      pixelsFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight
    } else if (typeof window !== 'undefined') {
      pixelsFromBottom =
        document.documentElement.scrollHeight -
        (window.innerHeight + window.scrollY)
    }

    // If user scrolled up beyond threshold AND auto-scroll was previously enabled via ref
    if (autoScrollIsEnabledRef.current && pixelsFromBottom > threshold) {
      autoScrollIsEnabledRef.current = false // Set ref immediately
      setIsAutoScroll(false) // Set state

      // Clear interval immediately if it's running
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }
  }, [scrollContainer, threshold]) // Depends only on these props

  // Add scroll event listener
  useEffect(() => {
    const options = { passive: true }
    const currentScrollElement = scrollContainer?.current

    if (currentScrollElement) {
      currentScrollElement.addEventListener('scroll', handleScroll, options)
      return () => {
        currentScrollElement.removeEventListener('scroll', handleScroll)
      }
    }
    // No window fallback, listener is only for the specified container
    return undefined
  }, [handleScroll, scrollContainer, scrollContainer?.current]) // Re-run when .current changes

  // Setup intersection observer for auto re-enabling
  useEffect(() => {
    if (
      !anchorRef.current ||
      isAutoScroll || // Observer is active only when auto-scroll is off
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined
    }

    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries
        if (entry.isIntersecting && entry.intersectionRatio >= 0.95) {
          autoScrollIsEnabledRef.current = true
          setIsAutoScroll(true)
        }
      },
      {
        root: scrollContainer?.current ?? null,
        threshold: 0.95,
        rootMargin: '0px 0px 5px 0px'
      }
    )
    observer.observe(anchorRef.current)
    return () => {
      observer.disconnect()
    }
  }, [anchorRef, isAutoScroll, scrollContainer])

  // Function to manually scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (!autoScrollIsEnabledRef.current) {
      return
    }
    if (!anchorRef.current) return

    try {
      requestAnimationFrame(() => {
        if (!anchorRef.current || !autoScrollIsEnabledRef.current) return // Double check ref inside rAF
        anchorRef.current.scrollIntoView({
          behavior: dependency > 5 ? 'instant' : 'smooth',
          block: 'end'
        })
      })
    } catch (error) {
      console.error('[useAutoScroll] Error scrolling:', error)
    }
  }, [dependency]) // dependency is the main driver for scroll content change

  // Function to enable auto-scrolling
  const enable = useCallback(() => {
    autoScrollIsEnabledRef.current = true // Set ref first
    setIsAutoScroll(true) // Then set state
    setTimeout(scrollToBottom, 0) // scrollToBottom will respect the ref
  }, [scrollToBottom])

  // Perform auto-scroll when content changes or state allows
  useLayoutEffect(() => {
    if (!autoScrollIsEnabledRef.current) {
      return
    }

    scrollToBottom()

    // Clear any existing interval before potentially starting a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = undefined
    }

    if (autoScrollIsEnabledRef.current && isStreaming && isLoading) {
      intervalRef.current = setInterval(scrollToBottom, 150)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }
  }, [dependency, isLoading, isStreaming, isAutoScroll, scrollToBottom]) // isAutoScroll is needed to re-trigger effect when it changes state

  return {
    anchorRef,
    isAutoScroll,
    enable
  }
}
