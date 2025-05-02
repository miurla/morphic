import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const exampleMessages = [
  {
    heading: 'Analyze NVIDIA Q4 2024 Earnings',
    message: 'Analyze NVIDIA Q4 2024 Earnings'
  },
  {
    heading: 'Compare Tesla vs. BYD Market Position',
    message: 'Compare Tesla vs. BYD Market Position'
  },
  {
    heading: 'Microsoft AI Strategy Impact',
    message: "Analyze Microsoft's AI strategy and its impact on future growth"
  },
  {
    heading: 'Meta Platforms Growth Analysis',
    message: "Analyze Meta Platforms' growth trajectory and key drivers"
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
        <div className="mt-2 flex flex-col items-start space-y-2 mb-4">
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
