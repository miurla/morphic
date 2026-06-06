'use client'

import { useEffect, useRef, useState } from 'react'

import type { NativeIconName } from '@/lib/native/icon-map'
import { cn } from '@/lib/utils'

import { NativeIcon } from '@/components/native/native-icon'
import { NativePressable } from '@/components/native/native-pressable'

// Constants for timing delays
const FOCUS_OUT_DELAY_MS = 100 // Delay to ensure focus has actually moved

const nativeButtonBaseClassName =
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-[background-color,border-color,color,box-shadow,transform] duration-[140ms] ease-[var(--motion-ease-out)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
const nativeOutlineButtonClassName =
  'border border-input bg-background hover:bg-accent hover:text-accent-foreground'

interface ActionCategory {
  icon: NativeIconName
  label: string
  key: string
}

const actionCategories: ActionCategory[] = [
  {
    icon: 'research',
    label: 'Research',
    key: 'research'
  },
  {
    icon: 'compare',
    label: 'Compare',
    key: 'compare'
  },
  {
    icon: 'latest',
    label: 'Latest',
    key: 'latest'
  },
  {
    icon: 'summarize',
    label: 'Summarize',
    key: 'summarize'
  },
  {
    icon: 'explain',
    label: 'Explain',
    key: 'explain'
  }
]

const promptSamples: Record<string, string[]> = {
  research: [
    'Why is Nvidia growing so rapidly?',
    'Research the latest AI developments',
    'What are the key trends in robotics?',
    'What are the latest breakthroughs in renewable energy?'
  ],
  compare: [
    'Tesla vs BYD vs Toyota comparison',
    'Compare Next.js, Remix, and Astro',
    'AWS vs GCP vs Azure',
    'iPhone vs Android ecosystem comparison'
  ],
  latest: [
    'Latest news today',
    'What happened in tech this week?',
    'Recent breakthroughs in medicine',
    'Latest AI model releases'
  ],
  summarize: [
    'Summarize: https://arxiv.org/pdf/2504.19678',
    "Summarize this week's business news",
    'Create an executive summary of AI trends',
    'Summarize recent climate change research'
  ],
  explain: [
    'Explain neural networks simply',
    'How does blockchain work?',
    'What is quantum entanglement?',
    'Explain CRISPR gene editing'
  ]
}

interface ActionButtonsProps {
  onSelectPrompt: (prompt: string) => void
  onCategoryClick: (category: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement>
  className?: string
}

export function ActionButtons({
  onSelectPrompt,
  onCategoryClick,
  inputRef,
  className
}: ActionButtonsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleCategoryClick = (category: ActionCategory) => {
    setActiveCategory(category.key)
    onCategoryClick(category.label)
  }

  const handlePromptClick = (prompt: string) => {
    setActiveCategory(null)
    onSelectPrompt(prompt)
  }

  const resetToButtons = () => {
    setActiveCategory(null)
  }

  // Handle Escape key and clicks outside (including focus loss)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeCategory) {
        resetToButtons()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (activeCategory) {
          // Check if click is not on the input field
          if (!inputRef?.current?.contains(e.target as Node)) {
            resetToButtons()
          }
        }
      }
    }

    const handleFocusOut = () => {
      // Check if focus is moving outside both the container and input
      setTimeout(() => {
        const activeElement = document.activeElement
        if (
          activeCategory &&
          !containerRef.current?.contains(activeElement) &&
          activeElement !== inputRef?.current
        ) {
          resetToButtons()
        }
      }, FOCUS_OUT_DELAY_MS)
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [activeCategory, inputRef])

  // Calculate max height needed for samples (4 items * ~40px + padding)
  const containerHeight = 'h-[180px]'

  return (
    <div
      ref={containerRef}
      className={cn('relative', containerHeight, className)}
    >
      <div className="relative h-full">
        {/* Action buttons */}
        <div
          className={cn(
            'absolute inset-0 flex items-start justify-center pt-2 transition-opacity duration-[180ms] ease-[var(--motion-ease-out)]',
            activeCategory ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          <div className="flex flex-wrap justify-center gap-2 px-2">
            {actionCategories.map(category => {
              return (
                <NativePressable
                  key={category.key}
                  type="button"
                  pressScale={0.96}
                  className={cn(
                    nativeButtonBaseClassName,
                    nativeOutlineButtonClassName,
                    'h-9 gap-2 rounded-full whitespace-nowrap',
                    'text-xs sm:text-sm px-3 sm:px-4'
                  )}
                  onClick={() => handleCategoryClick(category)}
                >
                  <NativeIcon
                    name={category.icon}
                    className="h-3 w-3 sm:h-4 sm:w-4"
                  />
                  <span>{category.label}</span>
                </NativePressable>
              )
            })}
          </div>
        </div>

        {/* Prompt samples */}
        <div
          className={cn(
            'absolute inset-0 space-y-1 overflow-y-auto py-1 transition-opacity duration-[180ms] ease-[var(--motion-ease-out)]',
            !activeCategory ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          {activeCategory &&
            promptSamples[activeCategory]?.map((prompt, index) => (
              <NativePressable
                key={index}
                type="button"
                pressScale={0.99}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm',
                  'transition-colors duration-[140ms] ease-[var(--motion-ease-out)] hover:bg-muted',
                  'flex items-center gap-2 group'
                )}
                onClick={() => handlePromptClick(prompt)}
              >
                <NativeIcon
                  name="search"
                  className="h-3 w-3 text-muted-foreground flex-shrink-0 group-hover:text-foreground"
                />
                <span className="line-clamp-1">{prompt}</span>
              </NativePressable>
            ))}
        </div>
      </div>
    </div>
  )
}
