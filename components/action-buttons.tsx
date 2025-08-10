'use client'

import { useEffect, useRef, useState } from 'react'

import {
  FileText,
  HelpCircle,
  LucideIcon,
  Newspaper,
  Scale,
  Search
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'

interface ActionCategory {
  icon: LucideIcon
  label: string
  key: string
}

const actionCategories: ActionCategory[] = [
  {
    icon: Search,
    label: 'Research',
    key: 'research'
  },
  {
    icon: Scale,
    label: 'Compare',
    key: 'compare'
  },
  {
    icon: Newspaper,
    label: 'Latest',
    key: 'latest'
  },
  {
    icon: FileText,
    label: 'Summarize',
    key: 'summarize'
  },
  {
    icon: HelpCircle,
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
  className?: string
}

export function ActionButtons({
  onSelectPrompt,
  onCategoryClick,
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
          const input = document.querySelector('textarea[name="input"]')
          if (!input?.contains(e.target as Node)) {
            resetToButtons()
          }
        }
      }
    }

    const handleFocusOut = () => {
      // Check if focus is moving outside both the container and input
      setTimeout(() => {
        const activeElement = document.activeElement
        const input = document.querySelector('textarea[name="input"]')
        if (
          activeCategory &&
          !containerRef.current?.contains(activeElement) &&
          activeElement !== input
        ) {
          resetToButtons()
        }
      }, 100) // Small delay to ensure focus has actually moved
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [activeCategory])

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
            'absolute inset-0 flex items-start justify-center pt-2 transition-opacity duration-300',
            activeCategory ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          <div className="flex flex-wrap justify-center gap-2 px-2">
            {actionCategories.map(category => {
              const Icon = category.icon
              return (
                <Button
                  key={category.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-full',
                    'text-xs sm:text-sm px-3 sm:px-4'
                  )}
                  onClick={() => handleCategoryClick(category)}
                >
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{category.label}</span>
                </Button>
              )
            })}
          </div>
        </div>

        {/* Prompt samples */}
        <div
          className={cn(
            'absolute inset-0 py-1 space-y-1 overflow-y-auto transition-opacity duration-300',
            !activeCategory ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          {activeCategory &&
            promptSamples[activeCategory]?.map((prompt, index) => (
              <button
                key={index}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm',
                  'hover:bg-muted transition-colors',
                  'flex items-center gap-2 group'
                )}
                onClick={() => handlePromptClick(prompt)}
              >
                <Search className="h-3 w-3 text-muted-foreground flex-shrink-0 group-hover:text-foreground" />
                <span className="line-clamp-1">{prompt}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
