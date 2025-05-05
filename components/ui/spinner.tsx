// Based on: https://github.com/vercel/ai/blob/main/examples/next-ai-rsc/components/llm-stocks/spinner.tsx

import { cn } from '@/lib/utils'
import { IconLogo } from './icons'

interface SpinnerProps extends React.SVGProps<SVGSVGElement> {}

export const Spinner = ({ className, ...props }: SpinnerProps) => (
  <svg
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('h-5 w-5 animate-spin stroke-zinc-400', className)}
    {...props}
  >
    <path d="M12 3v3m6.366-.366-2.12 2.12M21 12h-3m.366 6.366-2.12-2.12M12 21v-3m-6.366.366 2.12-2.12M3 12h3m-.366-6.366 2.12 2.12"></path>
  </svg>
)

export const LogoSpinner = () => (
  <div className="p-4 border border-background">
    <IconLogo className="w-4 h-4 animate-spin" />
  </div>
)
