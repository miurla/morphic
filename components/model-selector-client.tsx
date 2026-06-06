'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'

import {
  MODEL_SELECTION_COOKIE,
  serializeModelSelectionCookie
} from '@/lib/config/model-selection-cookie'
import { ModelSelectorData } from '@/lib/types/model-selector'
import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import { getCookie, setCookie } from '@/lib/utils/cookies'

import { NativeIcon } from './native/native-icon'
import { NativePressable } from './native/native-pressable'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

function modelKey(model: Model): string {
  return `${model.providerId}:${model.id}`
}

const PROVIDER_LOGO_BY_ID: Record<string, string> = {
  openai: '/providers/logos/openai.svg',
  anthropic: '/providers/logos/anthropic.svg',
  google: '/providers/logos/google.svg',
  gateway: '/providers/logos/gateway.svg',
  'openai-compatible': '/providers/logos/openai-compatible.svg',
  ollama: '/providers/logos/ollama.svg',
  openrouter: '/providers/logos/openrouter.svg'
}

function ProviderLogo({ providerId }: { providerId: string }) {
  const logoSrc = PROVIDER_LOGO_BY_ID[providerId]
  if (!logoSrc) {
    return <span className="size-4 rounded-full bg-muted-foreground/30" />
  }

  return (
    <Image
      src={logoSrc}
      alt={`${providerId} logo`}
      width={16}
      height={16}
      className="size-4 shrink-0 object-contain"
    />
  )
}

interface ModelSelectorClientProps {
  data: ModelSelectorData
}

export function ModelSelectorClient({ data }: ModelSelectorClientProps) {
  const [open, setOpen] = useState(false)
  const [selectedModelKey, setSelectedModelKey] = useState<string>(
    data.selectedModelKey
  )

  const providerEntries = useMemo(
    () =>
      Object.entries(data.modelsByProvider).sort(([providerA], [providerB]) =>
        providerA.localeCompare(providerB)
      ),
    [data.modelsByProvider]
  )

  const selectableModels = useMemo(
    () => providerEntries.flatMap(([, models]) => models),
    [providerEntries]
  )

  const selectableByKey = useMemo(
    () =>
      Object.fromEntries(
        selectableModels.map(model => [modelKey(model), model])
      ) as Record<string, Model>,
    [selectableModels]
  )

  const selectedModel = selectableByKey[selectedModelKey]

  useEffect(() => {
    if (!data.enabled || !selectedModel) {
      return
    }

    const serialized = serializeModelSelectionCookie({
      providerId: selectedModel.providerId,
      modelId: selectedModel.id
    })

    if (getCookie(MODEL_SELECTION_COOKIE) !== serialized) {
      setCookie(MODEL_SELECTION_COOKIE, serialized)
    }
  }, [data.enabled, selectedModel])

  if (!data.enabled) {
    return null
  }

  if (!data.hasAvailableModels) {
    return (
      <NativePressable
        className="flex h-auto items-center gap-1 rounded-full border-none bg-muted px-3 py-2 text-sm shadow-none transition-[background-color,color,box-shadow,transform] opacity-50 cursor-not-allowed"
        disabled
        title="No enabled models are available"
      >
        <span className="truncate max-w-52 text-xs font-medium">
          No enabled model available
        </span>
      </NativePressable>
    )
  }

  if (!selectedModel) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <NativePressable
          role="combobox"
          aria-expanded={open}
          className="flex h-auto items-center gap-1 rounded-full border-none bg-muted px-3 py-2 text-sm shadow-none transition-[background-color,color,box-shadow,transform]"
        >
          <ProviderLogo providerId={selectedModel.providerId} />
          <span className="truncate max-w-40 text-xs font-medium">
            {selectedModel.name}
          </span>
          <NativeIcon
            name="chevronDown"
            className={cn(
              'ml-0.5 h-3 w-3 opacity-50 transition-transform duration-[160ms] ease-[var(--motion-ease-out)]',
              open && 'rotate-180'
            )}
          />
        </NativePressable>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="end" sideOffset={6}>
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            {providerEntries.map(([provider, models]) => (
              <CommandGroup key={provider} heading={provider}>
                {models.map(model => {
                  const value = modelKey(model)
                  const isSelected = selectedModelKey === value
                  return (
                    <CommandItem
                      key={value}
                      value={`${value} ${model.name} ${provider}`}
                      onSelect={() => {
                        const nextModel = selectableByKey[value]
                        if (!nextModel) {
                          return
                        }

                        setSelectedModelKey(value)
                        setCookie(
                          MODEL_SELECTION_COOKIE,
                          serializeModelSelectionCookie({
                            providerId: nextModel.providerId,
                            modelId: nextModel.id
                          })
                        )
                        setOpen(false)
                      }}
                      className="cursor-pointer"
                    >
                      <NativeIcon
                        name="check"
                        className={cn(
                          'h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <ProviderLogo providerId={model.providerId} />
                      <span className="truncate">{model.name}</span>
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
