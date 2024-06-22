import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { useState, useEffect } from 'react'

const exampleMessages = [
  {
    heading: 'What is Apple Intelligence?',
    message: 'What is Apple Intelligence?'
  },
  {
    heading: 'Why is Nvidia growing rapidly?',
    message: 'Why is Nvidia growing rapidly?'
  },
  {
    heading: 'How does the Vercel AI SDK work?',
    message: 'How does the Vercel AI SDK work?'
  },
  {
    heading: 'Tesla vs Rivian',
    message: 'Tesla vs Rivian'
  },
  {
    heading: 'What is Claude 3.5 sonnet?',
    message: 'What is Claude 3.5 sonnet?'
  },
  {
    heading: 'What is the Benefits of Remote Work?',
    message: 'What is the Benefits of Remote Work?'
  },
  {
    heading: 'How does AI in Healthcare?',
    message: 'How does AI in Healthcare?'
  },
  {
    heading: 'What are the latest advancements in Robotics?',
    message: 'What are the latest advancements in Robotics?'
  }
]
export function EmptyScreen({
  submitMessage,
  className
}: {
  submitMessage: (message: string) => void
  className?: string
}) {
  const [displayMessages, setDisplayMessages] = useState(
    exampleMessages.slice(0, 4)
  )
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayMessages(prev => {
        const startIndex = exampleMessages.indexOf(prev[0]) + 4
        if (startIndex >= exampleMessages.length)
          return exampleMessages.slice(0, 4)
        return exampleMessages.slice(startIndex, startIndex + 4)
      })
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`mx-auto w-full transition-all ${className}`}>
      <div className="bg-background p-2">
        <div className="mt-4 flex flex-col items-start space-y-2 mb-4">
          {displayMessages.map((message, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-base"
              name={message.message}
              onClick={async () => {
                submitMessage(message.message)
              }}
            >
              <ArrowRight size={16} className="mr-2 text-muted-foreground" />
              {message.heading}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
