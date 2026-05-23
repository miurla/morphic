'use client'

import Link from 'next/link'

import {
  IconBrandDiscord as SiDiscord,
  IconBrandGithub as SiGithub,
  IconBrandX as SiX
} from '@tabler/icons-react'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

const externalLinks = [
  {
    name: 'X',
    href: 'https://x.com/morphic_ai',
    icon: <SiX className="size-4" />
  },
  {
    name: 'Discord',
    href: 'https://discord.gg/zRxaseCuGq',
    icon: <SiDiscord className="size-4" />
  },
  {
    name: 'GitHub',
    href: 'https://git.new/morphic',
    icon: <SiGithub className="size-4" />
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
