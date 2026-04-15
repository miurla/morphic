'use client'

import { useEffect, useRef, useState } from 'react'

type Stage =
  | 'init'
  | 'typing-in'
  | 'visible'
  | 'typing-out'
  | 'switching'
  | 'idle'

export interface TypewriterCycleOptions {
  /** Duration to show the first item (ms) */
  firstDuration?: number
  /** Duration to show each subsequent item (ms) */
  itemDuration?: number
  /** Idle pause between items (ms) */
  idleDuration?: number
  /** Typing speed per character (ms) */
  charInterval?: number
  /** Delay before first item appears (ms) */
  initialDelay?: number
}

const DEFAULTS: Required<TypewriterCycleOptions> = {
  firstDuration: 5000,
  itemDuration: 15000,
  idleDuration: 15000,
  charInterval: 25,
  initialDelay: 300
}

export function useTypewriterCycle(
  items: string[],
  options?: TypewriterCycleOptions
) {
  const {
    firstDuration,
    itemDuration,
    idleDuration,
    charInterval,
    initialDelay
  } = { ...DEFAULTS, ...options }

  const [stage, setStage] = useState<Stage>('init')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentText = items[currentIndex] ?? ''

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  useEffect(() => {
    clearTimers()

    switch (stage) {
      case 'init':
        timerRef.current = setTimeout(() => {
          setCharCount(0)
          setStage('typing-in')
        }, initialDelay)
        break

      case 'typing-in':
        intervalRef.current = setInterval(() => {
          setCharCount(prev => {
            const next = prev + 1
            if (next >= currentText.length) {
              if (intervalRef.current) clearInterval(intervalRef.current)
              setStage('visible')
            }
            return next
          })
        }, charInterval)
        break

      case 'visible': {
        const duration = currentIndex === 0 ? firstDuration : itemDuration
        timerRef.current = setTimeout(() => {
          setStage('typing-out')
        }, duration)
        break
      }

      case 'typing-out':
        intervalRef.current = setInterval(() => {
          setCharCount(prev => {
            const next = prev - 1
            if (next <= 0) {
              if (intervalRef.current) clearInterval(intervalRef.current)
              setStage('switching')
            }
            return Math.max(0, next)
          })
        }, charInterval)
        break

      case 'switching':
        timerRef.current = setTimeout(() => {
          setCurrentIndex(p => (p + 1) % items.length)
          setCharCount(0)
          setStage('idle')
        }, 50)
        break

      case 'idle':
        timerRef.current = setTimeout(() => {
          setStage('typing-in')
        }, idleDuration)
        break
    }

    return clearTimers
  }, [
    stage,
    currentIndex,
    items,
    currentText.length,
    initialDelay,
    charInterval,
    firstDuration,
    itemDuration,
    idleDuration
  ])

  return {
    currentIndex,
    charCount,
    displayText: currentText.slice(0, charCount),
    isIdle: stage === 'idle' || stage === 'init' || stage === 'switching'
  }
}
