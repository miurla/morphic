import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const exampleMessages = [
  {
    heading: 'Why is Nvidia growing rapidly?',
    message: 'Why is Nvidia growing rapidly?'
  },
  {
    heading: '国有企业转让资产，交易价款是否允许分期支付？',
    message: '国有企业转让资产，交易价款是否允许分期支付？'
  },
  {
    heading: '个体工商户如何享受个人所得税减半征税政策？',
    message: '个体工商户如何享受个人所得税减半征税政策？'
  },
  {
    heading: '高新技术企业进口关税优惠政策具体内容',
    message: '高新技术企业进口关税优惠政策具体内容'
  }
  // {
  //   heading: '小米汽车是否值得购买?',
  //   message: '小米汽车是否值得购买?'
  // },
  // {
  //   heading: '通用人工智能(AGI)有可能实现吗？',
  //   message: '通用人工智能(AGI)有可能实现吗？'
  // }
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
