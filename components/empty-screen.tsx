import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const exampleMessages = [
  {
    heading: 'Can you analyse meta title, description and search intend for the keyword: "email marketing?',
    message: 'Can you analyse meta title, description and search intend for the keyword: "email marketing'
  },
  {
    heading: 'Can you find best backlink oppourtunies for my website?',
    message: 'Can you find best backlink oppourtunies for my website?'
  },
  {
    heading: 'Can you help my to find long tail keyword about email marketing?',
    message: 'Can you help my to find long tail keyword about email marketing?'
  },
  {
    heading: 'Can you create a SEO strategy plan for my niche website?',
    message: 'Can you create a SEO strategy plan for my niche website?'
  }
]
export function EmptyScreen({
  submitMessage,
  className
}: {
  submitMessage: (message: string) => void
  className?: string
}) {
  return (
    <div className={`mx-auto w-full transition-all ${className}`}>
      <div className="bg-background p-2">
        <div className="mt-4 flex flex-col items-start space-y-2 mb-4">
          {exampleMessages.map((message, index) => (
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
