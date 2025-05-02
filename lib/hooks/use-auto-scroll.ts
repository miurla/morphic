import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAutoScrollOptions {
  isLoading: boolean
  dependency: number
  isStreaming: () => boolean
  scrollContainer?: React.RefObject<HTMLElement>
  threshold?: number
  intervalMs?: number
}

interface UseAutoScrollReturn {
  anchorRef: React.RefObject<HTMLDivElement>
  isAutoScroll: boolean
}

/**
 * Custom hook to auto-scroll to a target element and pause when the user scrolls away.
 */
export function useAutoScroll({
  isLoading,
  dependency,
  isStreaming,
  scrollContainer,
  threshold = 70,
  intervalMs = 100
}: UseAutoScrollOptions): UseAutoScrollReturn {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isAutoScroll, setIsAutoScroll] = useState(true)

  // Detect user scroll to toggle auto-scroll
  const handleScroll = useCallback(() => {
    if (scrollContainer?.current) {
      const element = scrollContainer.current
      const atBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight <=
        threshold
      setIsAutoScroll(atBottom)
    } else if (typeof window !== 'undefined') {
      const scrollHeight = document.documentElement.scrollHeight
      const atBottom =
        window.innerHeight + window.scrollY >= scrollHeight - threshold
      setIsAutoScroll(atBottom)
    }
  }, [threshold, scrollContainer])

  useEffect(() => {
    if (scrollContainer?.current) {
      const element = scrollContainer.current
      element.addEventListener('scroll', handleScroll, { passive: true })
      return () => {
        element.removeEventListener('scroll', handleScroll)
      }
    } else if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => {
        window.removeEventListener('scroll', handleScroll)
      }
    }
    return undefined
  }, [handleScroll, scrollContainer])

  // Scroll to anchor element
  const scrollToBottom = useCallback(() => {
    if (anchorRef.current) {
      if (scrollContainer?.current) {
        anchorRef.current.scrollIntoView({
          behavior: dependency > 5 ? 'instant' : 'smooth',
          block: 'end'
        })
      } else {
        anchorRef.current.scrollIntoView({
          behavior: dependency > 5 ? 'instant' : 'smooth'
        })
      }
    }
  }, [dependency, scrollContainer])

  // Auto-scroll on updates and during streaming
  useEffect(() => {
    if (!isAutoScroll) return
    scrollToBottom()
    let intervalId: ReturnType<typeof setInterval> | undefined
    if (isAutoScroll && isStreaming() && isLoading) {
      intervalId = setInterval(scrollToBottom, intervalMs)
    }
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [
    dependency,
    isLoading,
    isAutoScroll,
    isStreaming,
    intervalMs,
    scrollToBottom
  ])

  return { anchorRef, isAutoScroll }
}
