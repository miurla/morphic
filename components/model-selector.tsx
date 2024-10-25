'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from './ui/select'
import Image from 'next/image'
import { Model, models } from '@/lib/types/models'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'

interface ModelSelectorProps {
  selectedModel: Model
  onModelChange: (model: Model) => void
}

function groupModelsByProvider(models: Model[]) {
  return models.reduce((groups, model) => {
    const provider = model.provider
    if (!groups[provider]) {
      groups[provider] = []
    }
    groups[provider].push(model)
    return groups
  }, {} as Record<string, Model[]>)
}

export function ModelSelector({
  selectedModel: initialModel,
  onModelChange
}: ModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useLocalStorage<Model>(
    'selectedModel',
    initialModel
  )
  const groupedModels = groupModelsByProvider(models)

  const handleModelChange = (modelId: string) => {
    const selectedModelData = models.find(model => model.id === modelId)
    if (selectedModelData) {
      setSelectedModel(selectedModelData)
      onModelChange(selectedModelData)
    }
  }

  return (
    <div className="absolute -top-8 left-2">
      <Select
        name="model"
        value={selectedModel.id}
        onValueChange={handleModelChange}
      >
        <SelectTrigger className="mr-2 h-7 text-xs border-none shadow-none focus:ring-0">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px] overflow-y-auto">
          {Object.entries(groupedModels).map(([provider, models]) => (
            <SelectGroup key={provider}>
              <SelectLabel className="text-xs sticky top-0 bg-background z-10">
                {provider}
              </SelectLabel>
              {models.map(model => (
                <SelectItem key={model.id} value={model.id} className="py-2">
                  <div className="flex items-center space-x-2">
                    <Image
                      src={`/providers/logos/${model.providerId}.svg`}
                      alt={model.provider}
                      width={14}
                      height={14}
                    />
                    <span className="text-xs font-medium">{model.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
