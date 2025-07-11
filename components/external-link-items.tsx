'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { SiDiscord, SiGithub, SiX } from 'react-icons/si'

const externalLinks = [
  {
    name: 'View Dashboard',
    href: 'https://bulldozer.datapilotplus.com',
    icon: <SiX className="mr-2 h-4 w-4" />
  },
  {
    name: 'Report a Problem',
    href: 'mailto:info@breakthroughgroup.com',
    icon: <SiDiscord className="mr-2 h-4 w-4" />
  },
  {
    name: 'View Insights',
    href: 'https://bulldozer.datapilotplus.com/feed',
    icon: <SiGithub className="mr-2 h-4 w-4" />
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
