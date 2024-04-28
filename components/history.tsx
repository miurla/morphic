import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import HistoryItem from './history-item'

type HistoryProps = {
  location: 'sidebar' | 'header'
}

export function History({ location }: HistoryProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn({ 'rounded-full': location === 'sidebar' })}
        >
          {location === 'header' ? <Menu /> : <ChevronLeft size={16} />}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-64">
        <SheetHeader>
          <SheetTitle>Search history</SheetTitle>
        </SheetHeader>
        <div className="py-2 overflow-y-auto">
          <HistoryItem
            query="Why is NVIDIA growing rapidly? hoge fuga piyo"
            date="2024-01-01"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
