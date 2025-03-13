import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const exampleMessages = [
  // {
  //   heading: 'What is DeepSeek R1?',
  //   message: 'What is DeepSeek R1?'
  // },
  // {
  //   heading: 'Why is Nvidia growing rapidly?',
  //   message: 'Why is Nvidia growing rapidly?'
  // },
  {
    heading: '上海的天气如何',
    message: '上海的天气如何'
  },
  {
    heading: '今天的科技圈新闻',
    message: '今天的科技圈新闻'
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
        <div className="mt-2 flex flex-col items-start space-y-2 mb-4 ">
          {exampleMessages.map((message, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-sm text-gray-600"
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
