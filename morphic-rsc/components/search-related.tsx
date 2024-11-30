'use client'

import React, { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { ArrowRight } from 'lucide-react'
import {
  StreamableValue,
  useActions,
  useStreamableValue,
  useUIState
} from 'ai/rsc'
import { AI } from '@/app/actions'
import { UserMessage } from './user-message'
import { PartialRelated } from '@/lib/schema/related'
import { Section } from './section'
import { Skeleton } from './ui/skeleton'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { models } from '@/lib/types/models'
import { getDefaultModelId } from '@/lib/utils'

export interface SearchRelatedProps {
  relatedQueries: StreamableValue<PartialRelated>
}

export const SearchRelated: React.FC<SearchRelatedProps> = ({
  relatedQueries
}) => {
  const { submit } = useActions()
  const [, setMessages] = useUIState<typeof AI>()
  const [data, error, pending] = useStreamableValue(relatedQueries)
  const [related, setRelated] = useState<PartialRelated>()

  const [selectedModelId] = useLocalStorage<string>(
    'selectedModel',
    getDefaultModelId(models)
  )

  useEffect(() => {
    if (!data) return
    setRelated(data)
  }, [data])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget as HTMLFormElement)

    // Get the submitter of the form
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLInputElement
    let query = ''
    if (submitter) {
      formData.append(submitter.name, submitter.value)
      query = submitter.value
    }

    // Add model information to formData
    formData.set('model', selectedModelId)

    const userMessage = {
      id: Date.now(),
      component: <UserMessage message={query} />
    }

    const responseMessage = await submit(formData)
    setMessages(currentMessages => [
      ...currentMessages,
      userMessage,
      responseMessage
    ])
  }

  return related ? (
    <Section title="Related" separator={true}>
      <form onSubmit={handleSubmit} className="flex flex-wrap">
        {Array.isArray(related.items) ? (
          related.items
            ?.filter(item => item?.query !== '')
            .map((item, index) => (
              <div className="flex items-start w-full" key={index}>
                <ArrowRight className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-accent-foreground/50" />
                <Button
                  variant="link"
                  className="flex-1 justify-start px-0 py-1 h-fit font-semibold text-accent-foreground/50 whitespace-normal text-left"
                  type="submit"
                  name={'related_query'}
                  value={item?.query}
                >
                  {item?.query}
                </Button>
              </div>
            ))
        ) : (
          <div>Not an array</div>
        )}
      </form>
    </Section>
  ) : error ? null : (
    <Section title="Related" separator={true}>
      <Skeleton className="w-full h-6" />
    </Section>
  )
}

export default SearchRelated
