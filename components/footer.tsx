import React from 'react'
import Link from 'next/link'
import { SiGooglechrome } from 'react-icons/si'
import { Button } from './ui/button'

const Footer: React.FC = () => {
  return (
    <footer className="w-fit p-1 md:p-2 fixed bottom-0 right-0">
      <div className="flex justify-end">
    
        <Button
          variant={'ghost'}
          size={'icon'}
          className="text-muted-foreground/50"
        >
          <Link href="https://seomator.com/ai-seo-assistant" target="_blank">
            <SiGooglechrome size={18} />
          </Link>
        </Button>
      </div>
    </footer>
  )
}

export default Footer
