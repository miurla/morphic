'use client'

import { useEffect, useState } from 'react'

import { Check, ChevronDown } from 'lucide-react'

import { ModelType } from '@/lib/types/model-type'
import { getCookie, setCookie } from '@/lib/utils/cookies'

import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu'

const MODEL_TYPE_OPTIONS: { value: ModelType; label: string }[] = [
  { value: 'speed', label: 'Speed' },
  { value: 'quality', label: 'Quality' }
]

export function ModelTypeSelector() {
  const [value, setValue] = useState<ModelType>('speed')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    const savedType = getCookie('modelType')
    if (savedType && ['speed', 'quality'].includes(savedType)) {
      setValue(savedType as ModelType)
    }
  }, [])

  const handleTypeSelect = (type: ModelType) => {
    setValue(type)
    setCookie('modelType', type)
    setDropdownOpen(false)
  }

  const selectedOption = MODEL_TYPE_OPTIONS.find(opt => opt.value === value)

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="text-sm rounded-full shadow-none gap-1 transition-all px-3 py-2 h-auto bg-muted border-none"
        >
          <span className="text-xs font-medium">{selectedOption?.label}</span>
          <ChevronDown
            className={`h-3 w-3 ml-0.5 opacity-50 transition-transform duration-200 ${
              dropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[120px]"
        sideOffset={5}
      >
        {MODEL_TYPE_OPTIONS.map(option => {
          const isSelected = value === option.value
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleTypeSelect(option.value)}
              className="relative flex items-center cursor-pointer"
            >
              <div className="w-4 h-4 mr-2 flex items-center justify-center">
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <span className="text-sm">{option.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
