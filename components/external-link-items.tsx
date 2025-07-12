'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { AlertCircle, BarChart, Home } from 'lucide-react'
import Link from 'next/link'

const externalLinks = [
  {
    name: 'View Dashboard',
    href: 'https://bulldozer.datapilotplus.com',
    icon: <Home className="mr-2 h-4 w-4" />
  },
  {
    name: 'Report a Problem',
    href: 'mailto:info@breakthroughgroup.com',
    icon: <AlertCircle className="mr-2 h-4 w-4" />
  },
  {
    name: 'View Insights',
    href: 'https://bulldozer.datapilotplus.com/feed',
    icon: <BarChart className="mr-2 h-4 w-4" />
  }
]

export function ExternalLinkItems() {
  return (
    <>
      {externalLinks.map(link => (
        <DropdownMenuItem key={link.name} asChild>
          <Link href={link.href} target="_blank" rel="noopener noreferrer">
            {link.icon}
            <span>{link.name}</span>
          </Link>
        </DropdownMenuItem>
      ))}
    </>
  )
}
