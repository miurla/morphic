'use client'

import { Model } from '@/lib/types/models'
import { getCookie, setCookie } from '@/lib/utils/cookies'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { createModelId } from '../lib/utils'

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
    } else {
      // Default to GPT-4.1 if no model is selected
      const gpt41Model = models.find(model => model.id === 'gpt-4.1')
      if (gpt41Model) {
        setValue(createModelId(gpt41Model))
        setCookie('selectedModel', JSON.stringify(gpt41Model))
      }
    }
  }, [models])

  const handleModelSelect = (id: string) => {
    const newValue = id === value ? '' : id
    setValue(newValue)

    const selectedModel = models.find(
      model => createModelId(model) === newValue
    )
    if (selectedModel) {
      setCookie('selectedModel', JSON.stringify(selectedModel))
    } else {
      setCookie('selectedModel', '')
    }

    setOpen(false)
  }

  const selectedModel = models.find(model => createModelId(model) === value)
  const groupedModels = groupModelsByProvider(models)

  // Custom BulldozerAI display - always show as BulldozerAI with Local 825 logo
  return (
    <div className="flex items-center space-x-1">
      <Image
        src="/images/local825-logo.png"
        alt="BulldozerAI"
        width={18}
        height={18}
        className="bg-white rounded-full border"
      />
      <span className="text-xs font-medium">BulldozerAI</span>
    </div>
  )
}
