import { JSONValue, Message, ToolInvocation } from 'ai'
import { useMemo } from 'react'
import { AnswerSection } from './answer-section'
import { ReasoningAnswerSection } from './reasoning-answer-section'
import RelatedQuestions from './related-questions'
import { ToolSection } from './tool-section'
import { UserMessage } from './user-message'

interface RenderMessageProps {
  message: Message
  messageId: string
  getIsOpen: (id: string) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  chatId?: string
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect,
  chatId
}: RenderMessageProps) {
  const relatedQuestions = useMemo(
    () =>
      message.annotations?.filter(
        annotation => (annotation as any)?.type === 'related-questions'
      ),
    [message.annotations]
  )

  // render for manual tool call
  const toolData = useMemo(() => {
    const toolAnnotations =
      (message.annotations?.filter(
        annotation =>
          (annotation as unknown as { type: string }).type === 'tool_call'
      ) as unknown as Array<{
        data: {
          args: string
          toolCallId: string
          toolName: string
          result?: string
          state: 'call' | 'result'
        }
      }>) || []

    // Group by toolCallId and prioritize 'result' state
    const toolDataMap = toolAnnotations.reduce((acc, annotation) => {
      const existing = acc.get(annotation.data.toolCallId)
      if (!existing || annotation.data.state === 'result') {
        acc.set(annotation.data.toolCallId, {
          ...annotation.data,
          args: annotation.data.args ? JSON.parse(annotation.data.args) : {},
          result:
            annotation.data.result && annotation.data.result !== 'undefined'
              ? JSON.parse(annotation.data.result)
              : undefined
        } as ToolInvocation)
      }
      return acc
    }, new Map<string, ToolInvocation>())

    return Array.from(toolDataMap.values())
  }, [message.annotations])

  if (message.role === 'user') {
    return <UserMessage message={message.content} />
  }

  if (message.toolInvocations?.length) {
    return (
      <>
        {message.toolInvocations.map(tool => (
          <ToolSection
            key={tool.toolCallId}
            tool={tool}
            isOpen={getIsOpen(messageId)}
            onOpenChange={open => onOpenChange(messageId, open)}
          />
        ))}
      </>
    )
  }

  return (
    <>
      {toolData.map(tool => (
        <ToolSection
          key={tool.toolCallId}
          tool={tool}
          isOpen={getIsOpen(tool.toolCallId)}
          onOpenChange={open => onOpenChange(tool.toolCallId, open)}
        />
      ))}
      {message.reasoning ? (
        <ReasoningAnswerSection
          content={{
            reasoning: message.reasoning,
            answer: message.content
          }}
          isOpen={getIsOpen(messageId)}
          onOpenChange={open => onOpenChange(messageId, open)}
          chatId={chatId}
        />
      ) : (
        <AnswerSection
          content={message.content}
          isOpen={getIsOpen(messageId)}
          onOpenChange={open => onOpenChange(messageId, open)}
          chatId={chatId}
        />
      )}
      {!message.toolInvocations &&
        relatedQuestions &&
        relatedQuestions.length > 0 && (
          <RelatedQuestions
            annotations={relatedQuestions as JSONValue[]}
            onQuerySelect={onQuerySelect}
            isOpen={getIsOpen(`${messageId}-related`)}
            onOpenChange={open => onOpenChange(`${messageId}-related`, open)}
          />
        )}
    </>
  )
}
