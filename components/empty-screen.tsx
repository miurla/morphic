import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const exampleMessages = [
  {
    heading: 'Research OSHA violations for ABC Construction',
    message: 'Research OSHA violations for ABC Construction'
  },
  {
    heading: 'Find NLRB cases involving XYZ Contractors',
    message: 'Find NLRB cases involving XYZ Contractors'
  },
  {
    heading: 'Analyze government contracts for Smith & Sons',
    message: 'Analyze government contracts for Smith & Sons'
  },
  {
    heading: 'Research union status of Johnson Builders',
    message: 'Research union status of Johnson Builders'
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
