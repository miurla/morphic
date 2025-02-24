'use client'

import { Model } from '@/lib/types/models'
import { getCookie, setCookie } from '@/lib/utils/cookies'
import { isReasoningModel } from '@/lib/utils/registry'
import { Check, ChevronsUpDown, Lightbulb } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { createModelId } from '../lib/utils'
import { Button } from './ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

function groupModelsByProvider(models: Model[]) {
  return models
    .filter(model => model.enabled)
    .reduce((groups, model) => {
      const provider = model.provider
      if (!groups[provider]) {
        groups[provider] = []
      }
      groups[provider].push(model)
      return groups
    }, {} as Record<string, Model[]>)
}

interface ModelSelectorProps {
  models: Model[]
}

export function ModelSelector({ models }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    const savedModel = getCookie('selectedModel')
    if (savedModel) {
      try {
        const model = JSON.parse(savedModel) as Model
        setValue(createModelId(model))
      } catch (e) {
        console.error('Failed to parse saved model:', e)
      }
    }
  }, [])

  const handleModelSelect = (id: string) => {
    const newValue = id === value ? '' : id
    setValue(newValue)
    
    const selectedModel = models.find(model => createModelId(model) === newValue)
    if (selectedModel) {
      setCookie('selectedModel', JSON.stringify(selectedModel))
    } else {
      setCookie('selectedModel', '')
    }
    
    setOpen(false)
  }

  const selectedModel = models.find(model => createModelId(model) === value)
  const groupedModels = groupModelsByProvider(models)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="text-sm rounded-full shadow-none focus:ring-0"
        >
          {selectedModel ? (
            <div className="flex items-center space-x-1">
              <Image
                src={`/providers/logos/${selectedModel.providerId}.svg`}
                alt={selectedModel.provider}
                width={18}
                height={18}
                className="bg-white rounded-full border"
              />
              <span className="text-xs font-medium">{selectedModel.name}</span>
              {isReasoningModel(selectedModel.id) && (
                <Lightbulb size={12} className="text-accent-blue-foreground" />
              )}
            </div>
          ) : (
            'Select model'
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            {Object.entries(groupedModels).map(([provider, models]) => (
              <CommandGroup key={provider} heading={provider}>
                {models.map(model => {
                  const modelId = createModelId(model)
                  return (
                    <CommandItem
                      key={modelId}
                      value={modelId}
                      onSelect={handleModelSelect}
                      className="flex justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <Image
                          src={`/providers/logos/${model.providerId}.svg`}
                          alt={model.provider}
                          width={18}
                          height={18}
                          className="bg-white rounded-full border"
                        />
                        <span className="text-xs font-medium">
                          {model.name}
                        </span>
                      </div>
                      <Check
                        className={`h-4 w-4 ${
                          value === modelId ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
