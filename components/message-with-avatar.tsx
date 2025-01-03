import { cn } from '@/lib/utils'
import { UserCircle2, Bot } from 'lucide-react'

interface MessageWithAvatarProps {
  children: React.ReactNode
  role: 'user' | 'assistant'
}

export function MessageWithAvatar({ children, role }: MessageWithAvatarProps) {
  return (
    <div className="flex gap-3">
      <div className="relative flex flex-col items-center">
        <div className={cn('mt-[10px]', role === 'assistant' && 'pl-4')}>
          {role === 'user' && (
            <UserCircle2 size={20} className="text-muted-foreground" />
          )}
        </div>
      </div>
      <div className="py-2 flex-1">{children}</div>
    </div>
  )
}
